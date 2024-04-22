// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract EcdsaOwnershipRegistryModuleKEY {
    using ECDSA for bytes32;

    string public constant NAME = "ECDSA Ownership Module For Key Management";
    mapping(address => address) internal _keyManagementOwners;
    uint256 limitBlock = 10;

    error AlreadyInited(address smartAccount);
    error ZeroAddressNotAllowedAsOwner();
    error NoOwnerRegisteredForSmartAccount(address smartAccount);
    error WrongSignatureLength();

    function initForSmartAccount(address eoaOwner) external returns (address) {
        if (_keyManagementOwners[msg.sender] != address(0))
            revert AlreadyInited(msg.sender);
        if (eoaOwner == address(0)) revert ZeroAddressNotAllowedAsOwner();
        _keyManagementOwners[msg.sender] = eoaOwner;
        return address(this);
    }

    function validate(
        bytes calldata data
    ) external view virtual returns (bool) {
        (bytes32 plaintext, uint256 numBlock, bytes memory signature) = abi
            .decode(data, (bytes32, uint256, bytes));

        require(block.number - numBlock < limitBlock, "too late");

        bytes32 ciphertext = keccak256(
            abi.encode(plaintext, blockhash(numBlock), numBlock)
        );

        if (_verifySignature(ciphertext, signature, msg.sender)) {
            return true;
        }
        return false;
    }

    function _verifySignature(
        bytes32 dataHash,
        bytes memory signature,
        address smartAccount
    ) internal view returns (bool) {
        address expectedSigner = _keyManagementOwners[smartAccount];
        if (expectedSigner == address(0))
            revert NoOwnerRegisteredForSmartAccount(smartAccount);
        if (signature.length < 65) revert WrongSignatureLength();
        address recovered = (dataHash.toEthSignedMessageHash()).recover(
            signature
        );
        if (expectedSigner == recovered) {
            return true;
        }
        recovered = dataHash.recover(signature);
        if (expectedSigner == recovered) {
            return true;
        }
        return false;
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
