// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.17;

import "./Path.sol";

contract TestQuoterV2 {
    address wrappedNative;

    constructor(address _warppedNative) {
        wrappedNative = _warppedNative;
    }

    function quoteExactInput(
        bytes memory path,
        uint256 amountIn
    )
        public
        returns (
            uint256 amountOut,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        )
    {
        (address tokenA, , ) = Path.decodeFirstPool(path);
        if (tokenA == wrappedNative) amountOut = amountIn / 1e10;
        else amountOut = amountIn * 1e10;
    }
}
