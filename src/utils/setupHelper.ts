import { EntryPoint__factory } from "@account-abstraction/contracts";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { deployments, ethers  } from "hardhat";
import { SmartAccount__factory, SmartAccountFactory__factory } from "../../typechain-types";

export const getEntryPoint = async () => {
    const EntryPointDeployment = await deployments.get("EntryPoint");
    return EntryPoint__factory.connect(
      EntryPointDeployment.address,
      ethers.provider
    );
  };

export const getSmartAccountImplementation = async () => {
  const SmartAccountImplDeployment = await deployments.get("SmartAccount");
  return SmartAccount__factory.connect(SmartAccountImplDeployment.address, ethers.provider);
};
  
export const getSmartAccountFactory = async () => {
  const SAFactoryDeployment = await deployments.get("SmartAccountFactory");
  return SmartAccountFactory__factory.connect(SAFactoryDeployment.address, ethers.provider);
};
