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

    /// @notice estimate ERC20 token receive in exchange with amountIn of native token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of native token
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

    /// @notice estimate native token receive in exchange with amountIn of ERC20 token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of ERC20 token
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

    /// @notice swap native token to ERC20 token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of native token
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

    /// @notice unwrap WETH by withdrawing
    function unwrapWeth(uint256 amount) internal {
        IWETH(address(wrappedNative)).withdraw(amount);
    }
}
