// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

// Import the required libraries and contracts
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "contracts/smart-account/utils/PancakeSwapHelper.sol";

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/// @title Sample ERC-20 Token Paymaster for ERC-4337
/// This Paymaster covers gas fees in exchange for ERC20 tokens charged using allowance pre-issued by ERC-4337 accounts.
/// The contract refunds excess tokens if the actual gas cost is lower than the initially provided amount.
/// The token price cannot be queried in the validation code due to storage access restrictions of ERC-4337.
/// The price is cached inside the contract and is updated in the 'postOp' stage if the change is >10%.
/// It is theoretically possible the token has depreciated so much since the last 'postOp' the refund becomes negative.
/// The contract reverts the inner user transaction in that case but keeps the charge.
/// The contract also allows honest clients to prepay tokens at a higher price to avoid getting reverted.
/// It also allows updating price configuration and withdrawing tokens by the contract owner.
/// The contract uses an Oracle to fetch the latest token prices.
/// @dev Inherits from BasePaymaster.
contract TokenPaymaster is BasePaymaster, UniswapHelper {
    struct TokenPaymasterConfig {
        /// @notice Estimated gas cost for refunding tokens after the transaction is completed
        uint48 refundPostopCost;
        /// @notice
        uint256 minSwapAmount;
    }

    // TODO how is this constructed 
    mapping(IERC20 => uint24) listTokenSupport;

    event ConfigUpdated(TokenPaymasterConfig tokenPaymasterConfig);
    event UserOperationSponsored(
        address indexed user,
        uint256 actualTokenCharge,
        uint256 actualGasCost
    );
    event Received(address indexed sender, uint256 value);

    /// @notice All 'price' variables are multiplied by this value to avoid rounding up
    uint256 private constant PRICE_DENOMINATOR = 1e26;

    TokenPaymasterConfig public tokenPaymasterConfig;

    /// @notice Initializes the TokenPaymaster contract with the given parameters.
    /// @param _entryPoint The EntryPoint contract used in the Account Abstraction infrastructure.
    /// @param _wrappedNative The ERC-20 token that wraps the native asset for current chain.
    /// @param _uniswap The Uniswap V3 SwapRouter contract.
    /// @param _tokenPaymasterConfig The configuration for the Token Paymaster.
    /// @param _uniswapHelperConfig The configuration for the Uniswap Helper.
    /// @param _owner The address that will be set as the owner of the contract.
    constructor(
        IEntryPoint _entryPoint,
        IERC20 _wrappedNative,
        ISwapRouter _uniswap,
        IQuoterV2 _uniswapQuote,
        TokenPaymasterConfig memory _tokenPaymasterConfig,
        UniswapHelperConfig memory _uniswapHelperConfig,
        address _owner
    )
        BasePaymaster(_entryPoint)
        UniswapHelper(
            _wrappedNative,
            _uniswap,
            _uniswapQuote,
            _uniswapHelperConfig
        )
    {
        setTokenPaymasterConfig(_tokenPaymasterConfig);
        transferOwnership(_owner);
    }

    // TODO what calls this and when 
    function addERC20Support(IERC20 token, uint24 fee) public onlyOwner {
        listTokenSupport[token] = fee;
    }

    /// @notice Updates the configuration for the Token Paymaster.
    /// @param _tokenPaymasterConfig The new configuration struct.
    function setTokenPaymasterConfig(
        TokenPaymasterConfig memory _tokenPaymasterConfig
    ) public onlyOwner {
        tokenPaymasterConfig = _tokenPaymasterConfig;
        emit ConfigUpdated(_tokenPaymasterConfig);
    }

    function setUniswapConfiguration(
        UniswapHelperConfig memory _uniswapHelperConfig
    ) external onlyOwner {
        _setUniswapHelperConfiguration(_uniswapHelperConfig);
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
                // NOTE pay fee in ERC20
                uint24 fee = listTokenSupport[IERC20(token)];
                require(fee != 0, "Token not support");

                tokenAmount = estimatesTokenToToken(
                    address(wrappedNative),
                    token,
                    preChargeNative,
                    fee
                );
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
                uint24 fee = 500;
                actualTokenNeeded = estimatesTokenToToken(
                    address(wrappedNative),
                    token,
                    actualChargeNative,
                    fee
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

            refillEntryPointDeposit(IERC20(token));
        }
    }

    /// @notice If necessary this function uses this Paymaster's token balance to refill the deposit on EntryPoint
    function refillEntryPointDeposit(IERC20 token) private {
        uint256 swappedWeth = 0;
        if (address(token) == address(wrappedNative)) {
            if (
                token.balanceOf(address(this)) >
                tokenPaymasterConfig.minSwapAmount
            ) {
                swappedWeth = token.balanceOf(address(this));
            }
        } else {
            uint24 fee = listTokenSupport[token];
            swappedWeth = _maybeSwapTokenToWeth(token, fee);
        }

        if (swappedWeth > 0) {
            unwrapWeth(swappedWeth);
            entryPoint.depositTo{value: address(this).balance}(address(this));
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