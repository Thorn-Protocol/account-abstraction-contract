// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

contract MockLuminexRouterV1 {
    address public immutable wrappedNative;

    constructor(address _wrappedNative) {
        wrappedNative = _wrappedNative;
    }

    function safeTransferNative(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "STE");
    }

    function swapExactTokensForROSE(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        safeTransferNative(msg.sender, amountIn / 1e12);
    }

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts) {
        uint[] memory result = new uint[](2);
        if (path[0] == wrappedNative) {
            result[0] = amountIn;
            result[1] = amountIn / 1e12;
        }
        if (path[1] == wrappedNative) {
            result[0] = amountIn;
            result[1] = amountIn * 1e12;
        }

        return result;
    }

    receive() external payable {}
}
