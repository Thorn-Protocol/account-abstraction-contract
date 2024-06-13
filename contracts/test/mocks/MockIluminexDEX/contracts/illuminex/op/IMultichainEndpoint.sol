// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IMultichainEndpoint {
    enum CallbackExecutionStatus {
        Success,
        Failed,
        Retry
    }

    function executeMessageWithTransfer(
        address _token,
        uint256 _amount,
        uint64 srcChainId,
        bytes memory _message
    ) external payable returns (CallbackExecutionStatus);

    function executeMessageWithTransferFallback(
        address _token,
        uint256 _amount,
        bytes calldata _message
    ) external payable returns (CallbackExecutionStatus);
}
