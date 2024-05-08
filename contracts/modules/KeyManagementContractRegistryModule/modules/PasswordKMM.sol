// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract PasswordKMM {
    string public constant NAME = "Password Module For Key Management";

    mapping(address => bytes32) private _passwordTable;

    error AlreadyInited(address smartAccount);
    error ZeroAddressNotAllowedAsOwner();
    error NoOwnerRegisteredForSmartAccount(address smartAccount);
    error WrongSignatureLength();

    function initForSmartAccount(
        string memory password
    ) external returns (address) {
        if (_passwordTable[msg.sender] == bytes32(0))
            revert AlreadyInited(msg.sender);
        _passwordTable[msg.sender] = keccak256(bytes(password));
        return address(this);
    }

    function validate(
        bytes calldata data
    ) external view virtual returns (bool) {
        string memory password = abi.decode(data, (string));

        if (_verifySignature(keccak256(bytes(password)), msg.sender)) {
            return true;
        }
        return false;
    }

    function _verifySignature(
        bytes32 hashedPassword,
        address smartAccount
    ) internal view returns (bool) {
        bytes32 expectedPasswordHash = _passwordTable[smartAccount];

        return (expectedPasswordHash == hashedPassword);
    }

    /**
     * @dev Checks if the address provided is a smart contract.
     * @param account Address to be checked.
     */
    function _isSmartContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
