import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    // await deploy("EcdsaOwnershipRegistryModule", {
    //     from: deployer,
    //     args: [],
    //     log: true,
    // });

    await deploy("EcdsaOwnershipRegistryModule", {
        from: deployer,
        args: [],
        log: true,
        // deterministicDeployment: true,
        skipIfAlreadyDeployed: true,
        autoMine: true,
      });

    
};
deploy.tags = ["hardhat", "folked-oasis", "localnet","testnet"];
export default deploy;
