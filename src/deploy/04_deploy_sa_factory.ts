import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSmartAccountImplementation } from "../utils/setupHelper";
import colors from "colors";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const smartAccountImplementation = await getSmartAccountImplementation();
    console.log(" deploying SmartAccountFactory with smartAccountImplementation: ", smartAccountImplementation.address);
    console.log(" deploying SmartAccountFactory with deployer: ", deployer);
    const tx = await deploy("SmartAccountFactory", {
        from: deployer,
        args: [smartAccountImplementation.address, deployer],
        log: false,
        deterministicDeployment: true,
        autoMine: true,
    });

    console.log(" 🚀 Deploy PrivateWrapperFactory at :: ", colors.green(tx.address));
    console.log("   🧾 Transaction hash tx: ", colors.blue(tx.receipt?.transactionHash!));
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet", "sapphire-mainnet"];
export default deploy;
