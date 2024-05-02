// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./ILuminexV1Pair.sol";

interface ILuminexV1Factory {
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint
    );

    function feeFreePairs(address pair) external view returns (bool);

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);

    function allPairs(uint) external view returns (address pair);

    function allPairsLength() external view returns (uint);

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (ILuminexV1Pair pair);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;
}
