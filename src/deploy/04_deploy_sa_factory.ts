import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSmartAccountImplementation } from "../utils/setupHelper";
import colors from "colors";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const smartAccountImplementation = await getSmartAccountImplementation();

    const tx = await deploy("SmartAccountFactory", {
        from: deployer,
        args: [smartAccountImplementation.address, deployer],
        log: false,
        deterministicDeployment: true,
        autoMine: true,
    });
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet", "sapphire-mainnet"];
export default deploy;
