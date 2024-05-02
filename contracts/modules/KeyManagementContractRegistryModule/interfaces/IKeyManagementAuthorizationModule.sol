// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// interface for modules to verify singatures signed over userOpHash
interface IKeyManagementAuthorizationModule {
    function validate(bytes calldata data) external view returns (bool result);
}
