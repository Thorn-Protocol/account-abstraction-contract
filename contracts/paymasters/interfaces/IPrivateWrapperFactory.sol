// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IPrivateWrapperFactory {
    function wrappers(address _token) external view returns (address);
}
