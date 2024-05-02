import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    ethers.provider.getBalance(deployer);
    await deploy("EntryPoint", {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
    });
};
deploy.tags = ["hardhat", "sapphire-testnet", "sapphire-localnet"];
export default deploy;
