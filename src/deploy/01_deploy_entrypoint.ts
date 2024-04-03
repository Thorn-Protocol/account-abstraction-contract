import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // const entryPointContract = await ethers.getContractFactory("EntryPoint");
    // console.log("Starting deployment...");
    // const entrypoint = await entryPointContract.deploy();
    // await entrypoint.deployed();
    // console.log("Contract deployed to:", entrypoint.address);
    console.log("hre = ", await ethers.provider.getBlockNumber());
    console.log("deployer = ", deployer);
    ethers.provider.getBalance(deployer);
    await deploy("EntryPoint", {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
    });
};
deploy.tags = ["hardhat", "testnet"];
export default deploy;
