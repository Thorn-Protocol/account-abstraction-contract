// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IPrivateWrapper {
    function wrap(uint256 amount, address to) external;

    function unwrap(uint256 amount, address to) external;

    function balanceOf(address account) external view returns (uint256);
}
