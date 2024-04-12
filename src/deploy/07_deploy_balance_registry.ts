import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const [signer0] = await hre.ethers.getSigners();

  const entryPoint = await deployments.get("EntryPoint");


  await deploy("ConfidentialBalanceRegistry", {
    from: deployer,
    args: [
      // entryPoint.address,
      signer0.address,
      signer0.address,
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ],
    log: true,
    // deterministicDeployment: true,
    skipIfAlreadyDeployed: true,
    autoMine: true,
  });
};

deploy.tags = ["local", "testnet"];
export default deploy;