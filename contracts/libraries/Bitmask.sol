// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Bitmask {
    function get(uint256 bitmap, uint256 index) internal pure returns (bool) {
        uint256 mask = 1 << (index & 0xff);
        return bitmap & mask != 0;
    }

    function setTo(uint256 bitmap, uint256 index, bool value) internal pure returns (uint256) {
        if (value) {
            return set(bitmap, index);
        } else {
            return unset(bitmap, index);
        }
    }

    function set(uint256 bitmap, uint256 index) internal pure returns (uint256) {
        uint256 mask = 1 << (index & 0xff);
        return bitmap | mask;
    }

    function unset(uint256 bitmap, uint256 index) internal pure returns (uint256) {
        uint256 mask = 1 << (index & 0xff);
        return bitmap & ~mask;
    }
}