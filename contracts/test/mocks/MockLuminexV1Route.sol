// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockLuminexRouterV1 {
    address public immutable wrappedNative;
    address public privateNative;

    constructor(address _wrappedNative) {
        wrappedNative = _wrappedNative;
    }

    function updatePrivateNative(address _privateNative) public {
        privateNative = _privateNative;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        uint8 decimal = ERC20(path[0]).decimals();

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        // transfer native
        if (decimal == 6) {
            SafeERC20.safeTransfer(
                IERC20(path[1]),
                msg.sender,
                amountIn * 1e12
            );
        } else {
            SafeERC20.safeTransfer(IERC20(path[1]), msg.sender, amountIn);
        }
    }

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts) {
        uint[] memory result = new uint[](2);

        if (path[0] == privateNative) {
            uint8 decimal = ERC20(path[1]).decimals();
            result[0] = amountIn;
            if (decimal == 6) {
                result[1] = amountIn / 1e12;
            } else {
                result[1] = amountIn;
            }
        }

        if (path[1] == privateNative) {
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
