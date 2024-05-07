import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getSmartAccountFactory, getSmartAccountWithModule } from "../../src/utils/setupHelper";

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

        const callData = await userSA.populateTransaction.execute(deployer.address, 0, "0x").then((tx) => tx.data!);

        return {
            entryPoint: entryPoint,
            callData,
            userSA,
        };

        const keyManagementModule = await ethers.getContractFactory("KeyManagement");
        const keyManagementSetupData = keyManagementModule.interface.encodeFunctionData("initForSmartAccount", [await userSA.address]);
    };
    it(" test 1 ", async () => {
        await setupTests();
    });
});
