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
    const tx = await deploy("PrivateWrapperFactory", {
        from: deployer,
        args: [multicall, wrappedNative, balanceRegistry, migrateFrom],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
    });
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet"];
export default deploy;
