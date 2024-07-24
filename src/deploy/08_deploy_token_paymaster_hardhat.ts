import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getEntryPoint, getLuminexRouterV1, getMockPrivateWrapperFactory, getMockWrappedNative } from "../utils/setupHelper";
import { TokenPaymaster } from "../../typechain-types";
import { parseEther } from "ethers/lib/utils";
import colors from "colors";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const entryPoint = await getEntryPoint();
    const wrappedNative = await getMockWrappedNative();
    const luminexRouterV1 = await getLuminexRouterV1();
    const privateWrapperFactory = (await getMockPrivateWrapperFactory()).address;
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("1"),
    };

    const tx = await deploy("TokenPaymaster", {
        from: deployer,
        args: [entryPoint.address, wrappedNative.address, luminexRouterV1.address, privateWrapperFactory, tokenPaymasterConfig, deployer],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
    });
};

deploy.tags = ["hardhat"];
export default deploy;
