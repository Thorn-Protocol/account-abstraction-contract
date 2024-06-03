import { deployments, ethers } from "hardhat";
import { makeEcdsaModuleUserOp, makeEcdsaModuleUserOpWithPaymaster } from "../utils/userOp";
import { encodeTransfer } from "../utils/testUtils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getEntryPoint, getSmartAccountImplementation, getSmartAccountFactory, getSmartAccountWithModule, getEcdsaOwnershipRegistryModule, getMockToken } from "../utils/setupHelper";
import { Wallet } from "ethers";
import { formatEther, formatUnits } from "ethers/lib/utils";

describe("Modular Smart Account Basics", async () => {
    let deployer: SignerWithAddress, smartAccountOwner: SignerWithAddress, charlie: SignerWithAddress;
    // console.log( await ethers.getSigners() );
    // beforeEach(async function () {
    //  [deployer] = await ethers.getSigners();
    // });
    const setupTests = async () => {
        [deployer] = await ethers.getSigners();
        console.log("Deployer Address = ", deployer.address);
        //await deployments.fixture();
        const mockToken = await getMockToken();
        const ecdsaModule = await getEcdsaOwnershipRegistryModule();
        const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
        const ecdsaOwnershipSetupData = EcdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await deployer.getAddress()]);
        const smartAccountDeploymentIndex = 0;
        const userSA = await getSmartAccountWithModule(ecdsaModule.address, ecdsaOwnershipSetupData, smartAccountDeploymentIndex);
        console.log(" userSA = ", userSA.address);
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        if (Number(nativeInAA) < 10) {
            await deployer.sendTransaction({
                to: userSA.address,
                value: ethers.utils.parseEther("10"),
            });
        }
        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" nativeAA  = ", nativeInAA);

        let amountTokenInAA = formatUnits(await mockToken.balanceOf(userSA.address), await mockToken.decimals());
        if (Number(amountTokenInAA) < 100) {
            await mockToken.mint(userSA.address, 100 * 1e6);
        }
        amountTokenInAA = formatUnits(await mockToken.balanceOf(userSA.address), await mockToken.decimals());
        console.log(" Amount token in AA = ", amountTokenInAA);
        return {
            entryPoint: await getEntryPoint(),
            smartAccountImplementation: await getSmartAccountImplementation(),
            smartAccountFactory: await getSmartAccountFactory(),
            mockToken: mockToken,
            ecdsaModule: ecdsaModule,
            userSA: userSA,
        };
    };

    it("Can send an ERC20 Transfer userOp", async () => {
        const { entryPoint, mockToken, userSA, ecdsaModule } = await setupTests();
        //   const charlieTokenBalanceBefore = await mockToken.balanceOf(charlie.address);
        const userOp = await makeEcdsaModuleUserOp("execute_ncC", [mockToken.address, ethers.utils.parseEther("0"), encodeTransfer(deployer.address, 50 * 1e6)], userSA.address, deployer, entryPoint, ecdsaModule.address, {
            preVerificationGas: 50000,
        });

        //   console.log("userop = ", userOp);

        // const tx = await entryPoint
        //     .connect(deployer)
        //     .handleOps([userOp], beneficiaryAddress, {
        //         gasLimit: 15000000,
        //         maxFeePerGas: userOp.maxFeePerGas,
        //         maxPriorityFeePerGas: userOp.maxFeePerGas,
        //     })
        //     .then(async (tx) => await tx.wait());
        const beneficiaryAddress = "0x".padEnd(42, "1");
        let amountTokenInAA = formatUnits(await mockToken.balanceOf(userSA.address), await mockToken.decimals());
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native Amount before tranfer:", nativeInAA);
        console.log(" token Amount before tranfer UserOp", amountTokenInAA);
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        console.log("sending tx to entrypoint........");
        try {
            //  console.log("Tx = ", (await tx.wait()).events!);
            console.log("Tx = ", (await tx.wait()).transactionHash);
        } catch (e) {
            console.log(" error sending Tx");
        }
        amountTokenInAA = formatUnits(await mockToken.balanceOf(userSA.address), await mockToken.decimals());
        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));

        console.log(" native Amount after tranfer:", nativeInAA);
        console.log(" token Amount after tranfer UserOp", amountTokenInAA);
        // await environment.sendUserOperation(userOp, entryPoint.address);
        // expect(await mockToken.balanceOf(charlie.address)).to.equal(
        //   charlieTokenBalanceBefore.add(tokenAmountToTransfer)
        // );
    }).timeout(200000);

    it("Can send a Native Token Transfer userOp", async () => {
        const { entryPoint, userSA, ecdsaModule } = await setupTests();
        const amountToTransfer = ethers.utils.parseEther("0.2");
        const userOp = await makeEcdsaModuleUserOp("execute_ncC", [deployer.address, amountToTransfer, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, {
            preVerificationGas: 50000,
        });
        const beneficiaryAddress = "0x".padEnd(42, "1");
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native Amount before tranfer:", nativeInAA);
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        try {
            //   console.log("Tx = ", (await tx.wait()).events!);
            const data = await tx.wait();
            console.log("Tx = ", data);
            console.log("Tx = ", data.events);
        } catch (e) {
            console.log(" error sending Tx");
        }

        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));

        console.log(" native Amount after tranfer:", nativeInAA);
        //expect(await charlie.getBalance()).to.equal(charlieBalanceBefore.add(amountToTransfer));
    }).timeout(200000);
});
// TODO: This test fails with the message paymaster uses banned opcode: BASEFEE
