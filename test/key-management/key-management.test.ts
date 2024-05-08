import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getKeyManagementModule, getPasswordKMMModule, getSmartAccountFactory, getSmartAccountWithModule } from "../../src/utils/setupHelper";
import { makeEcdsaModuleUserOp, makePasswordUserOp } from "../../src/utils/userOp";
import { parseEther } from "ethers/lib/utils";
import { keccak256 } from "ethereumjs-util";

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
      keyManagementModule,
      callData,
      userSA,
      ecdsaModule,
    };
  };
  it(" test 1 ", async () => {
    const { entryPoint, callData, userSA, keyManagementModule, ecdsaModule } = await setupTests();

    const password = "123456";

    const PasswordKMM = await getPasswordKMMModule();

    const tx0 = await PasswordKMM.populateTransaction.setPassword(password);
    console.log(" tx0 = ", tx0);
    const tx1 = await makeEcdsaModuleUserOp("execute", [tx0.to, 0, tx0.data], userSA.address, deployer, entryPoint, ecdsaModule.address);
    console.log("password before = ", await PasswordKMM.getPassword(userSA.address));
    const receipt = await (await entryPoint.connect(deployer).handleOps([tx1], deployer.address)).wait();
    console.log(" password after ", await PasswordKMM.getPassword(userSA.address));

    //enable password module to key management module
    const tx2 = await keyManagementModule.populateTransaction.enableModule(PasswordKMM.address);
    const tx3 = await makeEcdsaModuleUserOp("execute", [tx2.to, 0, tx2.data], userSA.address, deployer, entryPoint, ecdsaModule.address);
    await (await entryPoint.connect(deployer).handleOps([tx3], deployer.address)).wait();

    console.log(" module status after = ", await keyManagementModule.isModuleEnabled(userSA.address, PasswordKMM.address));

    const tx4 = await makePasswordUserOp("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address);
  });
});
