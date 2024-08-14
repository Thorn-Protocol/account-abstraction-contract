import { deployments, ethers } from "hardhat";
import {
    getEcdsaOwnershipRegistryModule,
    getEntryPoint,
    getSmartAccountFactory,
    getSmartAccountImplementation,
    getSmartAccountWithModule,
} from "../utils/setupHelper";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getContract } from "../../src/utils/setupHelper";
import { makeEcdsaModuleUserOp } from "../utils/userOp";
import { Wallet } from "ethers";
import { makeAutoTradingUserOp } from "../../src/utils/autoTrading";

describe("Modular Smart Account Basics", async () => {
    let deployer: SignerWithAddress;

    const setupTests = async () => {
        [deployer] = await ethers.getSigners();
        console.log("Deployer Address = ", deployer.address);
        await deployments.fixture();
        const ecdsaModule = await getEcdsaOwnershipRegistryModule();
        const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
        const ecdsaOwnershipSetupData = EcdsaOwnershipRegistryModule.interface.encodeFunctionData(
            "initForSmartAccount",
            [await deployer.getAddress()]
        );
        const smartAccountDeploymentIndex = 0;
        const userSA = await getSmartAccountWithModule(
            ecdsaModule.address,
            ecdsaOwnershipSetupData,
            smartAccountDeploymentIndex
        );

        console.log(" userSA = ", userSA.address);

        await deployer.sendTransaction({
            to: userSA.address,
            value: ethers.utils.parseEther("10"),
        });

        return {
            entryPoint: await getEntryPoint(),
            smartAccountImplementation: await getSmartAccountImplementation(),
            smartAccountFactory: await getSmartAccountFactory(),
            ecdsaModule: ecdsaModule,
            userSA: userSA,
        };
    };

    it("enable Auto-trading module", async () => {
        const { userSA, entryPoint, ecdsaModule } = await setupTests();
        const autoTradingModule = await getContract("AutoTradingModule");
        const tx1 = await userSA.populateTransaction.enableModule(autoTradingModule.address);

        const userOp1 = await makeEcdsaModuleUserOp(
            "execute_ncC",
            [tx1.to, 0, tx1.data],
            userSA.address,
            deployer,
            entryPoint,
            ecdsaModule.address,
            {
                preVerificationGas: 50000,
            }
        );
        const txResponse1 = await entryPoint.connect(deployer).handleOps([userOp1], deployer.address);
        const txReceipt1 = await txResponse1.wait();
        const authorizationKey = new Wallet(process.env.AUTHORIZATION_KEY!);
        const tx2 = await autoTradingModule.populateTransaction.setAuthorizationKey(authorizationKey.address);

        const userOp2 = await makeEcdsaModuleUserOp(
            "execute_ncC",
            [tx2.to, 0, tx2.data],
            userSA.address,
            deployer,
            entryPoint,
            ecdsaModule.address,
            {
                preVerificationGas: 50000,
            }
        );
        const txResponse2 = await entryPoint.connect(deployer).handleOps([userOp2], deployer.address);
        const txReceipt2 = await txResponse2.wait();

        const autoTrading = await getContract("AutoTrading");

        const tx3 = await autoTrading.populateTransaction.autoStoploss(1, [autoTrading.address]);

        const userOp3 = await makeAutoTradingUserOp(
            "execute_ncC",
            [tx3.to, 0, tx3.data],
            userSA.address,
            authorizationKey,
            entryPoint,
            autoTradingModule.address,
            {
                preVerificationGas: 50000,
            }
        );

        //  console.log("userOp3 = ", userOp3);

        const txRespone = await entryPoint.connect(deployer).handleOps([userOp3], authorizationKey.address);
        const txReceipt = await txRespone.wait();
    }).timeout(200000);
});
// TODO: This test fails with the message paymaster uses banned opcode: BASEFEE
