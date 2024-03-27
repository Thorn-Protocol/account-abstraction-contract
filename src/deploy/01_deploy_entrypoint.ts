import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const entryPointContract = await ethers.getContractFactory("EntryPoint");
    console.log("Starting deployment...");
    const entrypoint = await entryPointContract.deploy();
    await entrypoint.deployed();
    console.log("Contract deployed to:", entrypoint.address);
};
deploy.tags = ["hardhat", "folked-oasis", "localnet"];
export default deploy;
