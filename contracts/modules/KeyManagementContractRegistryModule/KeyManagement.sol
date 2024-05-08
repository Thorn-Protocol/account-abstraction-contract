// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import "./interfaces/IAuthorizationModulesKMM.sol";

import {SignatureRSV, EthereumUtils} from "@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {BaseAuthorizationModule} from "../BaseAuthorizationModule.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract KeyManagement is BaseAuthorizationModule {
    using ECDSA for bytes32;

    address internal constant SENTINEL_MODULES = address(0x1);

    mapping(address => mapping(address => address)) public _modules;
    mapping(address => address) internal publicAddress;
    mapping(address => bytes32) private privateSecret;

    error WrongValidationModule(address validationModule);

    function initForSmartAccount() external returns (address) {
        address keypairAddress;
        bytes32 keypairSecret;
        (keypairAddress, keypairSecret) = EthereumUtils.generateKeypair();
        publicAddress[msg.sender] = keypairAddress;
        privateSecret[msg.sender] = keypairSecret;
        return address(this);
    }

    function _setupModule(
        address setupContract,
        bytes memory setupData
    ) internal returns (address module) {
        if (setupContract == address(0)) revert("Wrong Module Setup Address");
        assembly {
            let success := call(
                gas(),
                setupContract,
                0,
                add(setupData, 0x20),
                mload(setupData),
                0,
                0
            )
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize())
            if iszero(success) {
                revert(ptr, returndatasize())
            }
            module := mload(ptr)
        }
    }

    modifier onlyOwner(bytes calldata data, address smartAccount) {
        (bytes memory moduleData, address validationModule) = abi.decode(
            data,
            (bytes, address)
        );
        if (_modules[msg.sender][validationModule] != address(0)) {
            require(
                IAuthorizationModulesKMM(validationModule).validate(
                    moduleData,
                    smartAccount
                ) == true,
                "Validate wrong"
            );
        } else {
            revert WrongValidationModule(validationModule);
        }
        _;
    }

    function sign(
        bytes calldata authenticationData,
        address smartAccount,
        bytes32 digest
    )
        public
        view
        onlyOwner(authenticationData, smartAccount)
        returns (SignatureRSV memory)
    {
        return
            EthereumUtils.sign(
                publicAddress[smartAccount],
                privateSecret[smartAccount],
                digest
            );
    }

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
    ) public view override returns (bytes4) {
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
        address keypairAddress = publicAddress[smartAccount];
        address recovered = (dataHash.toEthSignedMessageHash()).recover(
            signature
        );
        if (keypairAddress == recovered) {
            return true;
        }
        recovered = dataHash.recover(signature);
        if (keypairAddress == recovered) {
            return true;
        }
        return false;
    }
}

// bool verify = Sapphire.verify(
//     Sapphire.SigningAlg.Secp256k1PrehashedKeccak256,
//     bytes(keypairAddress),
//     dataHash,
//     "",
//     signature
// );
// return verify;
