import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getKeyManagementModule, getSmartAccountFactory, getSmartAccountWithModule } from "../../src/utils/setupHelper";
import { makeEcdsaModuleUserOp } from "../../src/utils/userOp";
import { parseEther } from "ethers/lib/utils";

describe("KeyManagement", function () {
  let deployer: SignerWithAddress;
  let bundler: SignerWithAddress;

  const setupTests = async () => {
    [deployer, bundler] = await ethers.getSigners();
    await deployments.fixture();

    const entryPoint = await getEntryPoint();
    const ecdsaModule = await getEcdsaOwnershipRegistryModule();
    const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
    const ecdsaOwnershipSetupData = EcdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await deployer.getAddress()]);
    const userSA = await getSmartAccountWithModule(ecdsaModule.address, ecdsaOwnershipSetupData, 0);
    console.log(" smart Account address", userSA.address);
    //enable module Key management
    await (await entryPoint.connect(deployer).depositTo(userSA.address, { value: parseEther("1") })).wait();

    const keyManagementModule = await getKeyManagementModule();
    const keyManagementSetupData = keyManagementModule.interface.encodeFunctionData("initForSmartAccount");
    const tx = userSA.populateTransaction.setupAndEnableModule(keyManagementModule.address, keyManagementSetupData);
    const txEcdsa = await makeEcdsaModuleUserOp("setupAndEnableModule", [keyManagementModule.address, keyManagementSetupData], userSA.address, deployer, entryPoint, ecdsaModule.address);
    await (await entryPoint.connect(deployer).handleOps([txEcdsa], deployer.address)).wait();
    const callData = await userSA.populateTransaction.execute(deployer.address, 0, "0x").then((tx) => tx.data!);

    return {
      entryPoint: entryPoint,
      callData,
      userSA,
    };
  };
  it(" test 1 ", async () => {
    await setupTests();
  });
});
