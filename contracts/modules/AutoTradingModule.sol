// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {BaseAuthorizationModule, ISignatureValidator} from "./BaseAuthorizationModule.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

import "@account-abstraction/contracts/core/Helpers.sol";

import "solidity-bytes-utils/contracts/BytesLib.sol";

contract AutoTradingModule is BaseAuthorizationModule {

    using BytesLib for bytes;

    using ECDSA for bytes32;

    bytes4 public constant AUTO_BUY_SELECTOR = 0x2e9d56ae;

    bytes4 public constant AUTO_SELL_SELECTOR = 0xa8cac061;

    bytes4 public constant AUTO_TAKE_PROFIT_SELECTOR = 0x1e980be6;

    bytes4 public constant AUTO_STOP_LOSS_SELECTOR = 0x45351060;

    // execute_ncC(address,uint256,bytes)
    bytes4 public constant EXECUTE_OPTIMIZED_SELECTOR = 0x0000189a;
 
    address public ROUTER ;

    constructor(address _router) {
        ROUTER = _router;
    }

    mapping(address => address) internal _authorizationKeys;

    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash) external view override returns (uint256) {
        address sender = userOp.sender;
        address authorizationKey = _authorizationKeys[sender];
        require(authorizationKey != address(0), "AutoTradingModule: sender not authorized");

        (bytes memory moduleSignature,) = abi.decode(userOp.signature, (bytes, address));

        bool validOp = validateData(userOp);
      
        bool validSig = ECDSA.recover( ECDSA.toEthSignedMessageHash(userOpHash) , moduleSignature) == authorizationKey;
    
        if (validOp && validSig) {
            return VALIDATION_SUCCESS;
        } else {
            return SIG_VALIDATION_FAILED;
        }

    }

    function setAuthorizationKey(address authorizationKey) external {
        _authorizationKeys[msg.sender] = authorizationKey;
    }


    function validateData(UserOperation memory op) internal view returns (bool)  {

        bytes4 opFncSig = bytes4(op.callData.slice(0, 4));

        bytes memory opData = op.callData.slice(4, op.callData.length - 4);

        require(opFncSig == EXECUTE_OPTIMIZED_SELECTOR, "AT01 invalid function signature");

        (address router, uint256 callValue, bytes memory callData) = abi.decode(opData, (address, uint256, bytes));

        require(callValue == 0, "AT02 invalid call value");

        require(router == ROUTER, "AT03 invalid router");

        bytes4 fncSig = bytes4(callData.slice(0, 4));

        require(fncSig == AUTO_BUY_SELECTOR || fncSig == AUTO_SELL_SELECTOR || fncSig == AUTO_TAKE_PROFIT_SELECTOR || fncSig == AUTO_STOP_LOSS_SELECTOR, "AT04 invalid function signature");

        return true;

    }

    function isValidSignature(
        bytes32 _dataHash,
        bytes memory _signature
    ) public pure override returns (bytes4) {
        (_dataHash, _signature);
        return 0xffffffff; 
    }
   
}
