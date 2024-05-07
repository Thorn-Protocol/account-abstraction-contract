import { deployments, ethers } from "hardhat";
import deploy from "../../src/deploy/01_deploy_entrypoint";
import { deployer, paymasters } from "../../typechain-types/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getLuminexRouterV1, getMockToken, getMockWrappedNative, getSmartAccountWithModule, getTokenPaymaster } from "../../src/utils/setupHelper";
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers/lib/utils";
import { fillAndSign, fillUserOp, makeEcdsaModuleUserOp, makeEcdsaModuleUserOpWithPaymaster, signUserOp } from "../../src/utils/userOp";

describe("Token Paymaster", function () {
    let deployer: SignerWithAddress;
    let bundler: SignerWithAddress;

    let chainId: number;

    const setupTests = async () => {
        [deployer] = await ethers.getSigners();
        await deployments.fixture();
        const entryPoint = await getEntryPoint();
        const mockToken = await getMockToken();
        const luminexRouterV1 = await getLuminexRouterV1();
        const ecdsaModule = await getEcdsaOwnershipRegistryModule();
        const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
        chainId = (await deployer.provider!.getNetwork()).chainId;
        const ecdsaOwnershipSetupData = EcdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await deployer.getAddress()]);

        const smartAccountDeploymentIndex = 0;
        const wrappedNative = await getMockWrappedNative();

        const userSA = await getSmartAccountWithModule(ecdsaModule.address, ecdsaOwnershipSetupData, smartAccountDeploymentIndex);
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        if (Number(nativeInAA) < 10) {
            await deployer.sendTransaction({
                to: userSA.address,
                value: ethers.utils.parseEther("10"),
            });
        }

        const callData = await userSA.populateTransaction.execute(deployer.address, 0, "0x").then((tx) => tx.data!);

        const paymaster = await getTokenPaymaster();

        //enable mockToken
        paymaster.connect(deployer).addERC20Support(mockToken.address);

        //deposit wrappnative token
        await wrappedNative.connect(deployer).mint(userSA.address, parseEther("1"));

        //deposit wrappnative token
        await mockToken.connect(deployer).mint(userSA.address, parseUnits("1", 6));

        //sudo Approve WrappedNative
        await wrappedNative.sudoApprove(userSA.address, paymaster.address, ethers.constants.MaxUint256);

        //sudo Approve ERC-20
        await mockToken.sudoApprove(userSA.address, paymaster.address, ethers.constants.MaxUint256);

        return {
            entryPoint: await getEntryPoint(),
            callData,
            userSA,
            accountOwner: deployer,
            ecdsaModule,
            paymaster,
            tokenPaymaster: mockToken,
            wrappedNative,
        };
    };
    it("Can execute transaction without paymaster ( use Native ) ", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule } = await setupTests();
        const userOp = await makeEcdsaModuleUserOp("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, {
            preVerificationGas: 50000,
        });

        const beneficiaryAddress = "0x".padEnd(42, "1");
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native Amount before tranfer:", nativeInAA);
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        try {
            //console.log("Tx = ", (await tx.wait()).events!);
            console.log("Tx = ", (await tx.wait()).gasUsed);
        } catch (e) {
            console.log(" error sending Tx");
        }
        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native Amount after tranfer:", nativeInAA);
    });

    it("Can execute transaction with paymaster ( use wrapped native token )", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, tokenPaymaster, wrappedNative } = await setupTests();
        //deposit for paymaster
        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });
        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, wrappedNative, {
            preVerificationGas: 50000,
        });
        let wrappedNativeInAA = formatEther(await wrappedNative.balanceOf(userSA.address));
        console.log(" wrappedNative Amount before tranfer:", wrappedNativeInAA);
        console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
        const beneficiaryAddress = "0x".padEnd(42, "1");
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        wrappedNativeInAA = formatEther(await wrappedNative.balanceOf(userSA.address));
        console.log(" wrappedNative Amount after tranfer:", wrappedNativeInAA);
        console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
    });

    it("Can execute transaction with paymaster ( use ERC-20 token) ", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, tokenPaymaster } = await setupTests();
        //deposit for paymaster
        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });
        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, tokenPaymaster, {
            preVerificationGas: 50000,
        });
        let amountTokenInAA = formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals());
        console.log(" token Amount before tranfer:", amountTokenInAA);
        console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
        const beneficiaryAddress = "0x".padEnd(42, "1");
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        amountTokenInAA = formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals());
        console.log(" token Amount after tranfer:", amountTokenInAA);
        console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
    });
});
