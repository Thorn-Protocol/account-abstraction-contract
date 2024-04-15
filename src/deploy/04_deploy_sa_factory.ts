import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSmartAccountImplementation } from "../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const smartAccountImplementation = await getSmartAccountImplementation();

    await deploy("SmartAccountFactory", {
        from: deployer,
        args: [smartAccountImplementation.address, deployer],
        log: true,
        // deterministicDeployment: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
    });
};

deploy.tags = ["sapphire-testnet", "sapphire-localnet"];
export default deploy;
