import { EntryPoint__factory } from "@account-abstraction/contracts";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { deployments, ethers  } from "hardhat";
import { SmartAccount__factory, SmartAccountFactory__factory } from "../../typechain-types";
import { BytesLike } from "ethers";
import hre from "hardhat";

export const getEntryPoint = async () => {
    const EntryPointDeployment = await deployments.get("EntryPoint");
    return EntryPoint__factory.connect(
      EntryPointDeployment.address,
      ethers.provider
    );
  };

export const getMockToken = async () => {
  const MockTokenDeployment = await deployments.get("MockToken");
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  return MockToken.attach(MockTokenDeployment.address);
};
  

export const getSmartAccountImplementation = async () => {
  const SmartAccountImplDeployment = await deployments.get("SmartAccount");
  return SmartAccount__factory.connect(SmartAccountImplDeployment.address, ethers.provider);
};
  
export const getEcdsaOwnershipRegistryModule = async () => {
  const EcdsaOwnershipRegistryModuleDeployment = await deployments.get(
    "EcdsaOwnershipRegistryModule"
  );
  const EcdsaOwnershipRegistryModule = await hre.ethers.getContractFactory(
    "EcdsaOwnershipRegistryModule"
  );
  return EcdsaOwnershipRegistryModule.attach(
    EcdsaOwnershipRegistryModuleDeployment.address
  );
};


export const getSmartAccountFactory = async () => {
  const SAFactoryDeployment = await deployments.get("SmartAccountFactory");
  return SmartAccountFactory__factory.connect(SAFactoryDeployment.address, ethers.provider);
};

export const getSmartAccountWithModule = async (
  moduleSetupContract: string,
  moduleSetupData: BytesLike,
  index: number
) => {
  const factory = await getSmartAccountFactory();
  const expectedSmartAccountAddress =
    await factory.getAddressForCounterFactualAccount(
      moduleSetupContract,
      moduleSetupData,
      index
    );
  await factory.deployCounterFactualAccount(
    moduleSetupContract,
    moduleSetupData,
    index
  );
  console.log
  return await hre.ethers.getContractAt(
    "SmartAccount",
    expectedSmartAccountAddress
  );
};