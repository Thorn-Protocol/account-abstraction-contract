// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import {BaseAuthorizationModule} from "../BaseAuthorizationModule.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract KeyManagementRegistryModule is BaseAuthorizationModule {
    using ECDSA for bytes32;
    string public constant NAME = "Key Management Contract Registry Module";
    string public constant VERSION = "0.1.0";

    mapping(address => address) public smartAccountKeyManager;

    error NoKeyManagementContractRegisteredForSmartAccount(
        address smartAccount
    );
    error AlreadyInitedForSmartAccount(address smartAccount);
    error ZeroAddressNotAllowedAsOwner();
    error WrongSignatureLength();
    error NoOwnerRegisteredForSmartAccount(address smartAccount);

    function initForSmartAccount(
        address keyManagementAddress
    ) external returns (address) {
        if (smartAccountKeyManager[msg.sender] != address(0))
            revert AlreadyInitedForSmartAccount(msg.sender);
        if (keyManagementAddress == address(0))
            revert ZeroAddressNotAllowedAsOwner();
        smartAccountKeyManager[msg.sender] = keyManagementAddress;
        return address(this);
    }

    /**
     * @dev validates userOperation
     * @param userOp User Operation to be validated.
     * @param userOpHash Hash of the User Operation to be validated.
     * @return sigValidationResult 0 if signature is valid, SIG_VALIDATION_FAILED otherwise.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external view virtual returns (uint256) {
        (bytes memory cleanEcdsaSignature, ) = abi.decode(
            userOp.signature,
            (bytes, address)
        );
        if (_verifySignature(userOpHash, cleanEcdsaSignature, userOp.sender)) {
            return VALIDATION_SUCCESS;
        }
        return SIG_VALIDATION_FAILED;
    }

    function isValidSignature(
        bytes32 dataHash,
        bytes memory moduleSignature
    ) public view virtual override returns (bytes4) {
        return
            isValidSignatureForAddress(dataHash, moduleSignature, msg.sender);
    }

    function isValidSignatureForAddress(
        bytes32 dataHash,
        bytes memory moduleSignature,
        address smartAccount
    ) public view virtual returns (bytes4) {
        if (_verifySignature(dataHash, moduleSignature, smartAccount)) {
            return EIP1271_MAGIC_VALUE;
        }
        return bytes4(0xffffffff);
    }

    function _verifySignature(
        bytes32 dataHash,
        bytes memory signature,
        address smartAccount
    ) internal view returns (bool) {
        address expectedSigner = smartAccountKeyManager[smartAccount];
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
}
