// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ILuminexUnwrapQueueConsumer {
    function consume(bytes memory data) external;
}