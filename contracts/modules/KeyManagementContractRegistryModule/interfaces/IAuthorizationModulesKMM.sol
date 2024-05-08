// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// interface for modules to verify singatures signed over userOpHash
interface IAuthorizationModulesKMM {
    function validate(
        bytes calldata data,
        address smartAccount
    ) external view returns (bool result);
}
