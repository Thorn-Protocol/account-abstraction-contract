// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../illuminex/op/celer/safeguard/Ownable.sol";

contract FeesCollector is Ownable {
    uint256 private _feesCollected;

    event FeesCollected(address indexed to, uint256 amount);
    event FeesDeposited(uint256 amount);

    function collectFees(address payable to, uint256 amount) public onlyOwner {
        require(amount <= _feesCollected, "Insufficient fees collected");

        _feesCollected -= amount;
        to.transfer(amount);

        emit FeesCollected(to, amount);
    }

    function _depositFees(uint256 amount) internal {
        _feesCollected += amount;
        emit FeesDeposited(amount);
    }
}
