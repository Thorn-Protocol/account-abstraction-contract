// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import {SignatureRSV, EthereumUtils} from "@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol";
import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";

contract KeyManagement {
    bool private _initialized;
    bool private _initPassword;
    string private _password;
    address public owner;
    address public keypairAddress;
    bytes32 private keypairSecret;

    constructor() {}

    function init(address _owner) external returns (address) {
        require(!_initialized, "AlreadyInitialized");
        owner = _owner;
        (keypairAddress, keypairSecret) = EthereumUtils.generateKeypair();
        _initialized = true;
        return owner;
    }

    function setPassword(string calldata password) public onlyOwner {
        _password = password;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    function sign(
        bytes32 digest
    ) public view onlyOwner returns (SignatureRSV memory) {
        return EthereumUtils.sign(keypairAddress, keypairSecret, digest);
    }

    // function verify(
    //     bytes memory contextOrHash,
    //     bytes memory message,
    //     bytes memory signature
    // ) public view returns (bool verify) {
    //     verify = Sapphire.verify(
    //         Sapphire.SigningAlg.Secp256k1PrehashedKeccak256,
    //         bytes(keypairAddress),
    //         contextOrHash,
    //         "",
    //         signature
    //     );
    // }
}
