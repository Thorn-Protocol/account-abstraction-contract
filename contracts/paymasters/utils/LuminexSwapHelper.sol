// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;
import "../interfaces/ILuminexRouterV1.sol";
import "../interfaces/IWrappedNative.sol";

abstract contract LuminexSwapHelper {
    event UniswapReverted(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    );

    struct UniswapHelperConfig {
        /// @notice Minimum native asset amount to receive from a single swap
        uint256 minSwapAmount;
        uint8 slippage;
    }

    address public immutable luminexRouterV1;
    address public immutable wrappedNative;

    constructor(address _luminexRouterV1, address _wrappnative) {
        luminexRouterV1 = _luminexRouterV1;
        wrappedNative = _wrappnative;
    }

    function estimateNativeToToken(
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = wrappedNative;
        path[1] = token;
        uint256[] memory result = ILuminexRouterV1(luminexRouterV1)
            .getAmountsOut(amountIn, path);
        amountOut = result[1];
    }

    function estimateTokenToNative(
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = wrappedNative;
        uint256[] memory result = ILuminexRouterV1(luminexRouterV1)
            .getAmountsOut(amountIn, path);
        amountOut = result[1];
    }

    function _swapTokenToNative(address token, uint256 amountIn) internal {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = wrappedNative;
        ILuminexRouterV1(luminexRouterV1).swapExactTokensForROSE(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function unwrapWeth(uint256 amount) internal {
        IWETH(address(wrappedNative)).withdraw(amount);
    }
}
