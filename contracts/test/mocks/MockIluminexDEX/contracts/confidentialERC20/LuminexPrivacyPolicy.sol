// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/Bitmask.sol";

contract LuminexPrivacyPolicy {
    using Bitmask for uint256;

    enum PrivacyPolicy {
        Reveal
    }

    mapping(address => mapping(address => uint256)) internal grantedAccess;

    function grant(address to, PrivacyPolicy accessType) public {
        uint256 accessIndex = uint256(accessType);

        require(!grantedAccess[msg.sender][to].get(accessIndex), "Access already granted");
        grantedAccess[msg.sender][to] = grantedAccess[msg.sender][to].set(accessIndex);
    }

    function revoke(address from, PrivacyPolicy accessType) public {
        uint256 accessIndex = uint256(accessType);

        require(grantedAccess[msg.sender][from].get(accessIndex), "No access granted yet");
        grantedAccess[msg.sender][from] = grantedAccess[msg.sender][from].unset(accessIndex);
    }

    function hasAccess(address owner, address accessor, PrivacyPolicy accessType) internal view returns (bool) {
        return grantedAccess[owner][accessor].get(uint256(accessType));
    }
}