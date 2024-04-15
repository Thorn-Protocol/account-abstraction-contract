// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;
import "./KeyManagement.sol";
import "./Proxy.sol";

contract KeyManagementFactory {
    address public immutable basicImplememntation;

    constructor(address _basicImplememntation) {
        require(
            _basicImplememntation != address(0),
            "implementation cannot be zero"
        );
        basicImplememntation = _basicImplememntation;
    }

    event KeyManagementCreation(address indexed proxy);

    function getAddressForAccount(
        address _owner
    ) external view returns (address _account) {
        bytes memory initializer = _getInitializer(_owner);
        bytes32 salt = keccak256(abi.encodePacked(initializer));

        bytes memory code = abi.encodePacked(
            type(Proxy).creationCode,
            uint256(uint160(basicImplememntation))
        );

        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(code))
        );

        _account = address(uint160(uint256(hash)));
    }

    function deployUseCreate2(address _owner) public returns (address proxy) {
        bytes memory initializer = _getInitializer(_owner);
        bytes32 salt = keccak256(abi.encodePacked(initializer));

        bytes memory deploymentData = abi.encodePacked(
            type(Proxy).creationCode,
            uint256(uint160(basicImplememntation))
        );

        assembly {
            proxy := create2(
                0x0,
                add(0x20, deploymentData),
                mload(deploymentData),
                salt
            )
        }

        require(address(proxy) != address(0), "Create2 call failed");
        emit KeyManagementCreation(proxy);
        return proxy;
    }

    function KeyManagementCreationCode() public pure returns (bytes memory) {
        return type(Proxy).creationCode;
    }

    function _getInitializer(
        address _owner
    ) internal pure returns (bytes memory) {
        return abi.encodeCall(KeyManagement.init, (_owner));
    }
}
