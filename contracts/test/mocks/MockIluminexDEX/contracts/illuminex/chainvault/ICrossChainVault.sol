// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICrossChainVault {
    function lock(address asset, uint256 amount) external returns (uint256);

    function unlock(address asset, uint256 amount) external;
}
