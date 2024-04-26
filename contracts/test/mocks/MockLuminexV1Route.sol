// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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
        uint8 decimal = ERC20(path[0]).decimals();
        if (decimal == 6) {
            safeTransferNative(msg.sender, amountIn * 1e12);
        } else {
            safeTransferNative(msg.sender, amountIn);
        }
    }

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts) {
        uint[] memory result = new uint[](2);

        if (path[0] == wrappedNative) {
            uint8 decimal = ERC20(path[1]).decimals();
            result[0] = amountIn;
            if (decimal == 6) {
                result[1] = amountIn / 1e12;
            } else {
                result[1] = amountIn;
            }
        }

        if (path[1] == wrappedNative) {
            result[0] = amountIn;
            uint8 decimal = ERC20(path[0]).decimals();
            if (decimal == 6) {
                result[1] = amountIn * 1e12;
            } else {
                result[1] = amountIn;
            }
        }

        return result;
    }

    receive() external payable {}
}
