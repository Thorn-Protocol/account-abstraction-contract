// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

library SellValidator {
    using BytesLib for bytes;

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    bytes4 public constant ERC20_APPROVE_SELECTOR = 0x095ea7b3;
    bytes4 public constant EXACT_OUTPUT_SINGLE_SELECTOR = 0xdb3e2198;
    bytes4 public constant UNIV2_SWAP_TOKENS_FOR_EXACT_ETH = 0x4a25d94a;

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
    function validateSell(
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
            require(payment == 0, "SV: no payment required");
            (address router, , bytes memory data) = abi.decode(
                opData,
                (address, uint256, bytes)
            );
            require(router == ROUTER, "SV: invalid router");
            validateSellTx(
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
                "SV: invalid tx list's length"
            );
            uint256 fncNum = addresses.length;
            require(fncNum >= 2 && fncNum <= 3, "SV: invalid number of txs");

            uint256 sellTxIndex;
            if (payment > 0) {
                require(
                    addresses[fncNum - 1] == FEE_RECIPIENT,
                    "SV: must pay fee"
                );
                require(
                    callValues[fncNum - 1] == payment,
                    "SV: invalid payment"
                );
                sellTxIndex = fncNum - 2;
            } else {
                sellTxIndex = fncNum - 1;
            }

            require(addresses[sellTxIndex] == ROUTER, "SV: invalid router");
            validateSellTx(
                data[sellTxIndex],
                op.sender,
                token,
                WRAPPED_NATIVE_TOKEN,
                spentAmount
            );

            if (sellTxIndex == 1) {
                require(addresses[0] == token, "SV: must approve token");

                bytes4 fncSig = bytes4(data[0].slice(0, 4));
                require(
                    fncSig == ERC20_APPROVE_SELECTOR,
                    "SV: Invalid op funtion signature"
                );

                bytes memory funcData = data[0].slice(4, data[0].length - 4);
                (address router, ) = abi.decode(funcData, (address, uint256));
                require(router == ROUTER, "SV: invalid spender");
            }
        } else {
            revert("Invalid op funtion signature");
        }

        return true;
    }

    function validateSellTx(
        bytes memory data,
        address sender,
        address token,
        address WRAPPED_NATIVE_TOKEN,
        uint256 spentAmount
    ) internal pure {
        bytes4 fncSig = bytes4(data.slice(0, 4));

        bytes memory funcData = data.slice(4, data.length - 4);

        if (fncSig == EXACT_OUTPUT_SINGLE_SELECTOR) {
            ExactOutputSingleParams memory params = abi.decode(
                funcData,
                (ExactOutputSingleParams)
            );

            require(
                params.tokenOut == WRAPPED_NATIVE_TOKEN,
                "SV: only accept Wrapped native token as tokenOut"
            );
            require(params.tokenIn == token, "SV: Wrong token out");
            require(
                params.amountOut == spentAmount,
                "SV: spent amounts mismatch"
            );
            require(params.recipient == sender, "SV: Wrong recipient");
        } else if (fncSig == UNIV2_SWAP_TOKENS_FOR_EXACT_ETH) {
            (uint256 amountOut, , address[] memory path, address to, ) = abi
                .decode(
                    funcData,
                    (uint256, uint256, address[], address, uint256)
                );
            require(amountOut == spentAmount, "BV: invalid amount in");
            require(path[0] == token, "BV: invalid token in");
            require(
                path[path.length - 1] == WRAPPED_NATIVE_TOKEN,
                "BV: invalid token out"
            );
            require(to == sender, "BV: invalid recipient");
        } else {
            revert("SV: swap function is not supported");
        }
    }
}
