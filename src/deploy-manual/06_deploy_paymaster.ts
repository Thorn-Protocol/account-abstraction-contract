import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { parseEther } from "ethers/lib/utils";
import {
    TokenPaymaster,
    UniswapHelper as UniswapHelperNamespace,
} from "../../typechain-types/contracts/smart-account/paymasters/TokenPaymaster";
import { ethers } from "hardhat";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const WETHAddress = "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f";

    // address of a contract specifically designed for retrieving quotes (estimated exchange rates) from PancakeSwap
    const pancakeSwapQuote = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

    // address of a PancakeSwap router contract
    const pankaceSwapRoute = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";

    const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("0.005"),
    };

    const uniswapHelperConfig: UniswapHelperNamespace.UniswapHelperConfigStruct = {
        minSwapAmount: parseEther("0.005"),
        slippage: "0",
    };

    const tokenPaymasterWallet = new ethers.Wallet(process.env.PRIVATE_KEY_TOKEN_PAYMASTER!);

    await deploy("TokenPaymaster", {
        from: deployer,
        args: [
            entryPoint,
            WETHAddress,
            pankaceSwapRoute,
            pancakeSwapQuote,
            tokenPaymasterConfig,
            uniswapHelperConfig,
            tokenPaymasterWallet.address,
        ],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
        value: "0x00",
    });
};

deploy.tags = ["testnet"];
export default deploy;
