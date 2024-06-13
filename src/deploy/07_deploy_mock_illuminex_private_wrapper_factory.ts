import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getMockBalanceRegistry, getMockWrappedNative } from "../utils/setupHelper";
import { AddressZero } from "../utils/testUtils";
import colors from "colors";
const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const multicall = AddressZero;
    const wrappedNative = (await getMockWrappedNative()).address;
    const balanceRegistry = AddressZero;
    const migrateFrom = AddressZero;

    console.log("                 🍄 multicall       :: ", colors.blue(multicall));
    console.log("                 🍄 wrapperNative   :: ", colors.blue(wrappedNative));
    console.log("                 🍄 balanceRegistry :: ", colors.blue(balanceRegistry));
    console.log("                 🍄 migrateFrom     :: ", colors.blue(migrateFrom));

    const tx = await deploy("PrivateWrapperFactory", {
        from: deployer,
        args: [multicall, wrappedNative, balanceRegistry, migrateFrom],
        deterministicDeployment: true,
        autoMine: true,
    });

    console.log(" 🚀 Deploy PrivateWrapperFactory at :: ", colors.green(tx.address));
    console.log(" 🧾 Transaction hash tx: ", colors.blue(tx.receipt?.transactionHash!));
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet"];
export default deploy;
