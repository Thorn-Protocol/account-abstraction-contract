// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ILuminexRouterV1 {
    function swapExactTokensForROSE(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}
