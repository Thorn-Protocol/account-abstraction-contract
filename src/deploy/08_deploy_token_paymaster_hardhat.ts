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

    console.log("                 🍄 entryPoint       :: ", colors.blue(entryPoint.address));
    console.log("                 🍄 wrappedNative    :: ", colors.blue(wrappedNative.address));
    console.log("                 🍄 luminexRouterV1  :: ", colors.blue(luminexRouterV1.address));
    console.log("                 🍄 privateWrapperFactory  :: ", colors.blue(luminexRouterV1.address));
    console.log("                 🍄 tokenPaymasterConfig  :: ", tokenPaymasterConfig);
    console.log("                 🍄 deployer  :: ", colors.blue(deployer));

    const tx = await deploy("TokenPaymaster", {
        from: deployer,
        args: [entryPoint.address, wrappedNative.address, luminexRouterV1.address, privateWrapperFactory, tokenPaymasterConfig, deployer],
        log: false,
        deterministicDeployment: true,
        autoMine: true,
    });
    console.log(" 🚀 Deploy TokenPaymaster at :: ", colors.green(tx.address));
    console.log(" 🧾 Transaction hash tx: ", colors.blue(tx.receipt?.transactionHash!));
};
deploy.tags = ["hardhat"];
export default deploy;
