import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getKeyManagementImplementation } from "../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const smartAccountImplementation = await getKeyManagementImplementation();

    await deploy("KeyManagementFactory", {
        from: deployer,
        args: [smartAccountImplementation.address],
        log: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
    });
};
deploy.tags = ["hardhat", "sapphire-testnet", "sapphire-localnet"];
export default deploy;
