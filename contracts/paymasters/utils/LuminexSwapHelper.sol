// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../interfaces/ILuminexRouterV1.sol";
import "../interfaces/IWrappedNative.sol";
import "../interfaces/IPrivateWrapper.sol";
import "../interfaces/IPrivateWrapperFactory.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title LuminexSwapHelper
 * @notice Helper contract to interact with LuminexRouterV1 for swapping native token to ERC20 token and vice versa
 */
abstract contract LuminexSwapHelper {
    address public immutable privateWrapperFactory;

    address public immutable luminexRouterV1;
    address public immutable wrappedNative;

    /// @param _luminexRouterV1 LuminexRouterV1 contract address
    /// @param _wrappnative Wrapped native token contract address
    constructor(
        address _luminexRouterV1,
        address _privateWrapperFactory,
        address _wrappnative
    ) {
        luminexRouterV1 = _luminexRouterV1;
        privateWrapperFactory = _privateWrapperFactory;
        wrappedNative = _wrappnative;
    }

    /// @notice estimate ERC20 token receive in exchange with amountIn of native token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of native token
    /// @return amountOut amount of ERC20 token receive in exchange with amountIn of native token
    function estimateNativeToToken(
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = IPrivateWrapperFactory(privateWrapperFactory).wrappers(
            wrappedNative
        );
        path[1] = IPrivateWrapperFactory(privateWrapperFactory).wrappers(token);
        uint256[] memory result = ILuminexRouterV1(luminexRouterV1)
            .getAmountsOut(amountIn, path);
        amountOut = result[1];
    }

    /// @notice estimate native token receive in exchange with amountIn of ERC20 token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of ERC20 token
    /// @return amountOut amount of native token receive in exchange with amountIn of ERC20 token
    function estimateTokenToNative(
        address token,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = IPrivateWrapperFactory(privateWrapperFactory).wrappers(token);
        path[1] = IPrivateWrapperFactory(privateWrapperFactory).wrappers(
            wrappedNative
        );
        uint256[] memory result = ILuminexRouterV1(luminexRouterV1)
            .getAmountsOut(amountIn, path);
        amountOut = result[1];
    }

    /// @notice swap native token to ERC20 token by calling LuminexRouterV1
    /// @param token ERC20 token address
    /// @param amountIn amount of native token
    function _swapTokenToNative(address token, uint256 amountIn) internal {
        //calculate private address
        address privateToken = IPrivateWrapperFactory(privateWrapperFactory)
            .wrappers(token);
        address privateNative = IPrivateWrapperFactory(privateWrapperFactory)
            .wrappers(wrappedNative);

        // convert token to private token
        IPrivateWrapper(privateToken).wrap(amountIn, address(this));

        //approve private token
        SafeERC20.safeApprove(IERC20(privateToken), luminexRouterV1, amountIn);

        address[] memory path = new address[](2);
        path[0] = privateToken;
        path[1] = privateNative;

        //swap token to native use DEX
        ILuminexRouterV1(luminexRouterV1).swapExactTokensForROSE(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp
        );

        //convert private native to public native
        IPrivateWrapper(privateNative).unwrap(
            IPrivateWrapper(privateNative).balanceOf(address(this)),
            address(this)
        );
    }

    /// @notice unwrap WETH by withdrawing
    /// @param amount amount of WETH to withdraw
    function unwrapWeth(uint256 amount) internal {
        IWETH(address(wrappedNative)).withdraw(amount);
    }
}
