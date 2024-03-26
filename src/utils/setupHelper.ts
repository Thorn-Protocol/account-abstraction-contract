import { EntryPoint__factory } from "@account-abstraction/contracts";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { deployments, ethers  } from "hardhat";

export const getEntryPoint = async () => {
    const EntryPointDeployment = await deployments.get("EntryPoint");
    return EntryPoint__factory.connect(
      EntryPointDeployment.address,
      ethers.provider
    );
  };