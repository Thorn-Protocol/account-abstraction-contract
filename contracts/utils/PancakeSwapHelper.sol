// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

/* solhint-disable not-rely-on-time */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryPayments.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "contracts/interfaces/IWETH.sol";

abstract contract UniswapHelper {
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
    /// @notice The Uniswap V3 SwapRouter contract
    ISwapRouter public immutable uniswapRoute;

    IQuoterV2 public immutable uniswapQuote;

    /// @notice The ERC20 token used for transaction fee payments
    // IERC20 public immutable token;

    /// @notice The ERC-20 token that wraps the native asset for current chain
    IERC20 public immutable wrappedNative;

    UniswapHelperConfig private uniswapHelperConfig;

    constructor(
        IERC20 _wrappedNative,
        ISwapRouter _uniswapRoute,
        IQuoterV2 _uniswapQuote,
        UniswapHelperConfig memory _uniswapHelperConfig
    ) {
        //_token.approve(address(_uniswap), type(uint256).max);
        //token = _token;
        wrappedNative = _wrappedNative;
        uniswapRoute = _uniswapRoute;
        uniswapQuote = _uniswapQuote;
        _setUniswapHelperConfiguration(_uniswapHelperConfig);
    }

    function _setUniswapHelperConfiguration(
        UniswapHelperConfig memory _uniswapHelperConfig
    ) internal {
        uniswapHelperConfig = _uniswapHelperConfig;
    }

    function _maybeSwapTokenToWeth(
        IERC20 tokenIn,
        uint24 fee
    ) internal returns (uint256) {
        uint256 tokenBalance = tokenIn.balanceOf(address(this));

        uint256 amountOutMin = addSlippage(
            estimatesTokenToToken(
                address(tokenIn),
                address(wrappedNative),
                tokenBalance,
                fee
            ),
            uniswapHelperConfig.slippage
        );

        if (amountOutMin < uniswapHelperConfig.minSwapAmount) {
            return 0;
        }

        // note: calling 'swapToToken' but destination token is Wrapped Ether
        return
            swapToToken(
                address(tokenIn),
                address(wrappedNative),
                tokenBalance,
                amountOutMin,
                fee
            );
    }

    function addSlippage(
        uint256 amount,
        uint8 slippage
    ) private pure returns (uint256) {
        return (amount * (1000 - slippage)) / 1000;
    }

    function unwrapWeth(uint256 amount) internal {
        IWETH(address(wrappedNative)).withdraw(amount);
    }

    // swap ERC-20 tokens at market price
    function swapToToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams(
                tokenIn, //tokenIn
                tokenOut, //tokenOut
                fee,
                address(this),
                block.timestamp, //deadline
                amountIn,
                amountOutMin,
                uint160(0)
            );

        try uniswapRoute.exactInputSingle(params) returns (uint256 _amountOut) {
            amountOut = _amountOut;
        } catch {
            emit UniswapReverted(tokenIn, tokenOut, amountIn, amountOutMin);
            amountOut = 0;
        }
    }

    function encodeFirstPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) public pure returns (bytes memory path) {
        path = abi.encodePacked(tokenA, fee, tokenB);
    }

    function estimatesTokenToToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) public returns (uint256 amountOut) {
        bytes memory path = encodeFirstPool(tokenIn, tokenOut, fee);
        (amountOut, , , ) = uniswapQuote.quoteExactInput(path, amountIn);
    }
}