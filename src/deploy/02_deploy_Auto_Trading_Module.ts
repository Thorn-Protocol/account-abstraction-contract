import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getContract } from "../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const autoTradingRoute = await getContract("AutoTrading");

    await deploy("AutoTradingModule", {
        from: deployer,
        args: [autoTradingRoute.address],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
    });
};
deploy.tags = ["hardhat", "sapphire-mainnet"];
export default deploy;
