import { EntryPoint__factory } from "@account-abstraction/contracts";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { deployments, ethers } from "hardhat";
import { KeyManagement__factory, SmartAccount__factory, SmartAccountFactory__factory } from "../../typechain-types";
import { BytesLike } from "ethers";
import hre from "hardhat";

export const getEntryPoint = async () => {
  const EntryPointDeployment = await deployments.get("EntryPoint");
  const EntryPoint = await hre.ethers.getContractFactory("EntryPoint");
  return EntryPoint.attach(EntryPointDeployment.address);
  // return EntryPoint__factory.connect(EntryPointDeployment.address, ethers.provider);
};

export const getMockToken = async () => {
  const MockTokenDeployment = await deployments.get("MockToken");
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  return MockToken.attach(MockTokenDeployment.address);
};

export const getLuminexRouterV1 = async () => {
  const MockLuminexRouterV1 = await hre.ethers.getContractFactory("MockLuminexRouterV1");
  const chaindId = (await hre.ethers.provider.getNetwork()).chainId;
  if (chaindId == 23294) {
    return MockLuminexRouterV1.attach("0x5b82acbDe21bda0E9E277BF29A0F84f8deB5F1A7");
  }
  const MockLuminexRouterV1Deployment = await deployments.get("MockLuminexRouterV1");
  return MockLuminexRouterV1.attach(MockLuminexRouterV1Deployment.address);
};

export const getTokenPaymaster = async () => {
  const TokenPaymasterDeployment = await deployments.get("TokenPaymaster");
  const TokenPaymaster = await hre.ethers.getContractFactory("TokenPaymaster");
  return TokenPaymaster.attach(TokenPaymasterDeployment.address);
};

export const getMockWrappedNative = async () => {
  const MockWrappedNative = await hre.ethers.getContractFactory("MockWrappedNative");

  const chaindId = (await hre.ethers.provider.getNetwork()).chainId;
  if (chaindId == 23295) {
    return MockWrappedNative.attach("0xB759a0fbc1dA517aF257D5Cf039aB4D86dFB3b94");
  }
  if (chaindId == 23294) {
    return MockWrappedNative.attach("0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3");
  }
  const MockWrappedNativeDeployment = await deployments.get("MockWrappedNative");
  return MockWrappedNative.attach(MockWrappedNativeDeployment.address);
};

export const getSmartAccountImplementation = async () => {
  const SmartAccountImplDeployment = await deployments.get("SmartAccount");
  return SmartAccount__factory.connect(SmartAccountImplDeployment.address, ethers.provider);
};

export const getEcdsaOwnershipRegistryModule = async () => {
  const EcdsaOwnershipRegistryModuleDeployment = await deployments.get("EcdsaOwnershipRegistryModule");
  const EcdsaOwnershipRegistryModule = await hre.ethers.getContractFactory("EcdsaOwnershipRegistryModule");
  return EcdsaOwnershipRegistryModule.attach(EcdsaOwnershipRegistryModuleDeployment.address);
};

// export const getSmartAccountFactory = async () => {
//   const SAFactoryDeployment = await deployments.get("SmartAccountFactory");
//   console.log("hre = ", await ethers.provider.getBlockNumber());
//   return SmartAccountFactory__factory.connect(SAFactoryDeployment.address, ethers.provider);
// };

export const getSmartAccountFactory = async () => {
  const SAFactoryDeployment = await deployments.get("SmartAccountFactory");
  const SmartAccountFactory = await hre.ethers.getContractFactory("SmartAccountFactory");
  const smartAccountFactory = SmartAccountFactory.attach(SAFactoryDeployment.address);
  return smartAccountFactory;
};

export const getSmartAccountWithModule = async (moduleSetupContract: string, moduleSetupData: BytesLike, index: number) => {
  const factory = await getSmartAccountFactory();
  //  console.log("factory = ", factory);
  //console.log("factory = ", factory.address, " moduleSetupContract = ", moduleSetupContract, " moduleSetupData", moduleSetupData, " index = ", index);
  const [deployer] = await ethers.getSigners();
  const expectedSmartAccountAddress = await factory.connect(deployer).getAddressForCounterFactualAccount(moduleSetupContract, moduleSetupData, index);
  //console.log(" expect = ", expectedSmartAccountAddress);
  await factory.deployCounterFactualAccount(moduleSetupContract, moduleSetupData, index);
  return await hre.ethers.getContractAt("SmartAccount", expectedSmartAccountAddress);
};

export const getKeyManagementImplementation = async () => {
  const KeyManagementImplDeployment = await deployments.get("KeyManagement");
  return KeyManagement__factory.connect(KeyManagementImplDeployment.address, ethers.provider);
};
