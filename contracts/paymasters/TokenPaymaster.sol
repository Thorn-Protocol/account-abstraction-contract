// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

// Import the required libraries and contracts
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "./utils/LuminexSwapHelper.sol";

/* 
This Paymaster covers gas fees in exchange for ERC20 tokens charged using allowance pre-issued by ERC-4337 accounts.
 The contract refunds excess tokens if the actual gas cost is lower than the initially provided amount.
 The token price cannot be queried in the validation code due to storage access restrictions of ERC-4337.
 It is theoretically possible the token has depreciated so much since the last 'postOp' the refund becomes negative.
 The contract reverts the inner user transaction in that case but keeps the charge.
 The contract also allows honest clients to prepay tokens at a higher price to avoid getting reverted.
 It also allows updating price configuration and withdrawing tokens by the contract owner.
 @dev Inherits from BasePaymaster.
 */
contract TokenPaymaster is BasePaymaster, LuminexSwapHelper {
    struct TokenPaymasterConfig {
        /// @notice Estimated gas cost for refunding tokens after the transaction is completed
        uint48 refundPostopCost;
        /// @notice
        uint256 minSwapAmount;
    }

    mapping(address => bool) public tokenSupport;
    mapping(address => uint256) public tokenToOrdinal;
    mapping(uint256 => address) public ordinalToToken;

    uint256 public countTokenSupport;
    uint256 public totalToken;

    address[] public listTokenSupport;

    event ConfigUpdated(TokenPaymasterConfig tokenPaymasterConfig);

    event UserOperationSponsored(
        address indexed user,
        uint256 actualTokenCharge,
        uint256 actualGasCost
    );

    event Received(address indexed sender, uint256 value);

    TokenPaymasterConfig public tokenPaymasterConfig;

    /// @notice Initializes the TokenPaymaster contract with the given parameters.
    /// @param _entryPoint The EntryPoint contract used in the Account Abstraction infrastructure.
    /// @param _wrappedNative The ERC-20 token that wraps the native asset for current chain.
    /// @param _tokenPaymasterConfig The configuration for the Token Paymaster.
    /// @param _owner The address that will be set as the owner of the contract.
    constructor(
        IEntryPoint _entryPoint,
        IERC20 _wrappedNative,
        ILuminexRouterV1 _luminexRouterV1,
        TokenPaymasterConfig memory _tokenPaymasterConfig,
        address _owner
    )
        BasePaymaster(_entryPoint)
        LuminexSwapHelper(address(_luminexRouterV1), address(_wrappedNative))
    {
        setTokenPaymasterConfig(_tokenPaymasterConfig);
        transferOwnership(_owner);
    }

    function addERC20Support(address token) public onlyOwner {
        if (tokenSupport[token]) revert("token was enabled");

        if (tokenToOrdinal[token] == 0) {
            // add new token
            totalToken++;
            countTokenSupport++;
            tokenToOrdinal[token] = totalToken;
            ordinalToToken[totalToken] = token;
            tokenSupport[token] = true;
        } else {
            // change state
            countTokenSupport++;
            tokenSupport[token] = true;
        }
    }

    function removeERC20Support(address token) public onlyOwner {
        require(tokenSupport[token], "Token was removed");
        countTokenSupport--;
        tokenSupport[token] = false;
    }

    function getListTokenSupport()
        public
        view
        returns (address[] memory result)
    {
        result = new address[](countTokenSupport);
        uint256 j = 0;
        for (uint256 i = 1; i <= totalToken; i++) {
            if (tokenSupport[ordinalToToken[i]] == true) {
                result[j] = ordinalToToken[i];
                j++;
            }
        }
        return result;
    }

    /// @notice Updates the configuration for the Token Paymaster.
    /// @param _tokenPaymasterConfig The new configuration struct.
    function setTokenPaymasterConfig(
        TokenPaymasterConfig memory _tokenPaymasterConfig
    ) public onlyOwner {
        tokenPaymasterConfig = _tokenPaymasterConfig;
        emit ConfigUpdated(_tokenPaymasterConfig);
    }

    /// @notice Allows the contract owner to withdraw a specified amount of tokens from the contract.
    /// @param to The address to transfer the tokens to.
    /// @param amount The amount of tokens to transfer.
    function withdrawToken(
        IERC20 token,
        address to,
        uint256 amount
    ) external onlyOwner {
        SafeERC20.safeTransfer(token, to, amount);
    }

    /// @notice Validates a paymaster user operation and calculates the required token amount for the transaction.
    /// @param userOp The user operation data.
    /// @param requiredPreFund The maximum cost (in native token) the paymaster has to prefund.
    /// @return context The context containing the token amount and user sender address (if applicable).
    /// @return validationResult A uint256 value indicating the result of the validation (always 0 in this implementation).
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPreFund
    )
        internal
        override
        returns (bytes memory context, uint256 validationResult)
    {
        unchecked {
            uint256 maxFeePerGas = userOp.maxFeePerGas;
            uint256 refundPostopCost = tokenPaymasterConfig.refundPostopCost;
            uint256 postOpGasLimit = uint128(
                bytes16(userOp.paymasterAndData[36:52])
            );
            require(
                refundPostopCost < postOpGasLimit,
                "TPM: postOpGasLimit too low"
            );

            uint256 preChargeNative = requiredPreFund +
                (refundPostopCost * maxFeePerGas);
            address token = address(bytes20(userOp.paymasterAndData[52:72]));
            uint256 tokenAmount = 0;
            if (token == address(wrappedNative)) {
                tokenAmount = preChargeNative;
            } else {
                require(tokenSupport[token], "Token not support");
                tokenAmount = estimateNativeToToken(token, preChargeNative);
            }

            SafeERC20.safeTransferFrom(
                IERC20(token),
                userOp.sender,
                address(this),
                tokenAmount
            );

            context = abi.encode(
                tokenAmount,
                token,
                userOp.sender,
                userOp.maxFeePerGas
            );

            validationResult = 0;
        }
    }

    /// @notice Performs post-operation tasks, such as updating the token price and refunding excess tokens.
    /// @dev This function is called after a user operation has been executed or reverted.
    /// @param context The context containing the token amount and user sender address.
    /// @param actualGasCost The actual gas cost of the transaction.
    //      It is not the same as tx.gasprice, which is what the bundler pays.

    function _postOp(
        PostOpMode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        unchecked {
            (
                uint256 preCharge,
                address token,
                address userOpSender,
                uint256 actualUserOpFeePerGas
            ) = abi.decode(context, (uint256, address, address, uint256));

            // Refund tokens based on actual gas cost
            uint256 actualChargeNative = actualGasCost +
                tokenPaymasterConfig.refundPostopCost *
                actualUserOpFeePerGas;

            uint256 actualTokenNeeded = 0;

            if (token == address(wrappedNative)) {
                actualTokenNeeded = actualChargeNative;
            } else {
                actualTokenNeeded = estimateNativeToToken(
                    token,
                    actualChargeNative
                );
            }

            if (preCharge > actualTokenNeeded) {
                // If the initially provided token amount is greater than the actual amount needed, refund the difference
                SafeERC20.safeTransfer(
                    IERC20(token),
                    userOpSender,
                    preCharge - actualTokenNeeded
                );
            } else if (preCharge < actualTokenNeeded) {
                // Attempt to cover Paymaster's gas expenses by withdrawing the 'overdraft' from the client
                // If the transfer reverts also revert the 'postOp' to remove the incentive to cheat
                SafeERC20.safeTransferFrom(
                    IERC20(token),
                    userOpSender,
                    address(this),
                    actualTokenNeeded - preCharge
                );
            }

            emit UserOperationSponsored(
                userOpSender,
                actualTokenNeeded,
                actualGasCost
            );

            refillEntryPointDeposit(token);
        }
    }

    /// @notice If necessary this function uses this Paymaster's token balance to refill the deposit on EntryPoint
    function refillEntryPointDeposit(address token) private {
        if (address(token) == address(wrappedNative)) {
            if (
                IERC20(token).balanceOf(address(this)) >
                tokenPaymasterConfig.minSwapAmount
            ) {
                unwrapWeth(IERC20(token).balanceOf(address(this)));
                entryPoint.depositTo{value: address(this).balance}(
                    address(this)
                );
            }
        } else {
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));

            uint256 estimateReceiveNative = estimateTokenToNative(
                token,
                tokenBalance
            );

            if (estimateReceiveNative > tokenPaymasterConfig.minSwapAmount) {
                _swapTokenToNative(token, tokenBalance);
                entryPoint.depositTo{value: address(this).balance}(
                    address(this)
                );
            }
        }
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function withdrawEth(
        address payable recipient,
        uint256 amount
    ) external onlyOwner {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "withdraw failed");
    }
}
