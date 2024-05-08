// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

library BuyValidator {
    using BytesLib for bytes;

    struct UniV3ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct AlgebraExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    bytes4 public constant WRAP_ETH_SELECTOR = 0xd0e30db0;
    bytes4 public constant ERC20_APPROVE_SELECTOR = 0x095ea7b3;

    bytes4 public constant UNIV3_EXACT_INPUT_SINGLE_SELECTOR = 0x414bf389;
    bytes4 public constant ALGEBRA_EXACT_INPUT_SINGLE_SELECTOR = 0xbc651188;
    bytes4 public constant UNIV2_SWAP_EXACT_ETH_FOR_TOKENS = 0x7ff36ab5;
    bytes4 public constant UNIV2_SWAP_EXACT_TOKENS_FOR_TOKENS = 0x38ed1739;

    // execute_ncC(address,uint256,bytes)
    bytes4 public constant EXECUTE_OPTIMIZED_SELECTOR = 0x0000189a;
    // function executeBatch_y6U( address[] calldata dest, uint256[] calldata value, bytes[] calldata func)
    bytes4 public constant EXECUTE_BATCH_SELECTOR = 0x00004680;

    /**
     * @dev validates if the _op (UserOperation) matches the SessionKey permissions
     * and that _op has been signed by this SessionKey
     * Please mind the decimals of your exact token when setting maxAmount
     * @param token the non-native token of the pair
     * @return true if the _op is valid, false otherwise.
     */
    function validateBuy(
        UserOperation memory op,
        address token,
        uint256 spentAmount,
        uint256 payment,
        address WRAPPED_NATIVE_TOKEN,
        address ROUTER,
        address FEE_RECIPIENT
    ) internal pure returns (bool) {
        bytes4 opFncSig = bytes4(op.callData.slice(0, 4));

        bytes memory opData = op.callData.slice(4, op.callData.length - 4);

        if (opFncSig == EXECUTE_OPTIMIZED_SELECTOR) {
            require(payment == 0, "BV: no payment required");
            (address router, uint256 callValue, bytes memory data) = abi.decode(
                opData,
                (address, uint256, bytes)
            );
            require(
                callValue == 0 || callValue == spentAmount,
                "BV: invalid call value"
            );
            require(router == ROUTER, "BV: invalid router");
            validateBuyTx(
                data,
                op.sender,
                token,
                WRAPPED_NATIVE_TOKEN,
                spentAmount
            );
        } else if (opFncSig == EXECUTE_BATCH_SELECTOR) {
            (
                address[] memory addresses,
                uint256[] memory callValues,
                bytes[] memory data
            ) = abi.decode(opData, (address[], uint256[], bytes[]));

            require(
                addresses.length == callValues.length &&
                    addresses.length == data.length,
                "BV: invalid tx list's length"
            );
            uint256 fncNum = addresses.length;
            require(fncNum >= 2 && fncNum <= 4, "BV: invalid number of txs");

            uint256 buyTxIndex;

            if (payment > 0) {
                require(
                    addresses[fncNum - 1] == FEE_RECIPIENT,
                    "BV: must pay fee"
                );
                require(
                    callValues[fncNum - 1] == payment,
                    "BV: invalid payment"
                );
                buyTxIndex = fncNum - 2;
            } else {
                buyTxIndex = fncNum - 1;
            }

            require(addresses[buyTxIndex] == ROUTER, "BV: invalid router");
            validateBuyTx(
                data[buyTxIndex],
                op.sender,
                token,
                WRAPPED_NATIVE_TOKEN,
                spentAmount
            );

            if (buyTxIndex == 0) {
                require(
                    callValues[0] == 0 || callValues[0] == spentAmount,
                    "BV: invalid callvalue"
                );
            } else if (buyTxIndex == 1) {
                require(callValues[1] == 0, "BV: invalid callvalue");
                require(
                    addresses[0] == WRAPPED_NATIVE_TOKEN,
                    "BV: must call the wrapped native"
                );
                bytes4 fncSig = bytes4(data[0].slice(0, 4));

                if (fncSig == ERC20_APPROVE_SELECTOR) {
                    validateApproveTx(data[0], ROUTER);
                } else {
                    require(
                        fncSig == WRAP_ETH_SELECTOR,
                        "BV: Invalid op funtion signature"
                    );
                }
            } else {
                require(callValues[2] == 0, "BV: invalid callvalue");
                require(
                    addresses[0] == WRAPPED_NATIVE_TOKEN &&
                        addresses[1] == WRAPPED_NATIVE_TOKEN,
                    "BV: must call the wrapped native"
                );
                require(
                    bytes4(data[0].slice(0, 4)) == WRAP_ETH_SELECTOR &&
                        bytes4(data[1].slice(0, 4)) == ERC20_APPROVE_SELECTOR,
                    "BV: Invalid op funtion signature"
                );
                validateApproveTx(data[1], ROUTER);
            }
        } else {
            revert("Invalid op funtion signature");
        }

        return true;
    }

    function validateBuyTx(
        bytes memory data,
        address sender,
        address token,
        address WRAPPED_NATIVE_TOKEN,
        uint256 spentAmount
    ) internal pure {
        bytes4 fncSig = bytes4(data.slice(0, 4));

        bytes memory funcData = data.slice(4, data.length - 4);

        if (fncSig == UNIV3_EXACT_INPUT_SINGLE_SELECTOR) {
            UniV3ExactInputSingleParams memory params = abi.decode(
                funcData,
                (UniV3ExactInputSingleParams)
            );

            require(
                params.tokenIn == WRAPPED_NATIVE_TOKEN,
                "BV: only accept Wrapped native token as tokenIn"
            );
            require(params.tokenOut == token, "BV: Wrong token out");
            require(
                params.amountIn == spentAmount,
                "BV: spent amounts mismatch"
            );
            require(params.recipient == sender, "BV: Wrong recipient");
        } else if (fncSig == ALGEBRA_EXACT_INPUT_SINGLE_SELECTOR) {
            AlgebraExactInputSingleParams memory params = abi.decode(
                funcData,
                (AlgebraExactInputSingleParams)
            );

            require(
                params.tokenIn == WRAPPED_NATIVE_TOKEN,
                "BV: only accept Wrapped native token as tokenIn"
            );
            require(params.tokenOut == token, "BV: Wrong token out");
            require(
                params.amountIn == spentAmount,
                "BV: spent amounts mismatch"
            );
            require(params.recipient == sender, "BV: Wrong recipient");
        } else if (fncSig == UNIV2_SWAP_EXACT_ETH_FOR_TOKENS) {
            (, address[] memory path, address to, ) = abi.decode(
                funcData,
                (uint256, address[], address, uint256)
            );
            require(path[0] == WRAPPED_NATIVE_TOKEN, "BV: invalid token in");
            require(path[path.length - 1] == token, "BV: invalid token out");
            require(to == sender, "BV: invalid recipient");
        } else if (fncSig == UNIV2_SWAP_EXACT_TOKENS_FOR_TOKENS) {
            (uint256 amountIn, , address[] memory path, address to, ) = abi
                .decode(
                    funcData,
                    (uint256, uint256, address[], address, uint256)
                );
            require(amountIn == spentAmount, "BV: invalid amount in");
            require(path[0] == WRAPPED_NATIVE_TOKEN, "BV: invalid token in");
            require(path[path.length - 1] == token, "BV: invalid token out");
            require(to == sender, "BV: invalid recipient");
        } else {
            revert("BV: Swap function is not supported");
        }
    }

    function validateApproveTx(
        bytes memory data,
        address ROUTER
    ) internal pure {
        bytes memory funcData = data.slice(4, data.length - 4);
        (address router, ) = abi.decode(funcData, (address, uint256));
        require(router == ROUTER, "BV: invalid spender");
    }
}
