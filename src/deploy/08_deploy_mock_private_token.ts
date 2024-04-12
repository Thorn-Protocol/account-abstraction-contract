import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const balanceRegistry = await deployments.get("ConfidentialBalanceRegistry");


    const config = {
        totalSupplyVisible: true,
        name: "MockPrivateToken",
        symbol: "MPT",
        decimals: 18
    };


    await deploy("MockPrivateToken", {
        from: deployer,
        args: [
            config,
            "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            balanceRegistry.address
        ],
        log: true,
        // deterministicDeployment: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
    });
};

deploy.tags = ["local", "testnet"];
export default deploy;