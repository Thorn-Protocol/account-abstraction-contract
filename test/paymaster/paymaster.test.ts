import { deployments, ethers } from "hardhat";
import deploy from "../../src/deploy/01_deploy_entrypoint";
import { deployer, paymasters } from "../../typechain-types/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getLuminexRouterV1, getMockToken, getMockWrappedNative, getSmartAccountWithModule, getTokenPaymaster } from "../../src/utils/setupHelper";
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers/lib/utils";
import { fillAndSign, fillUserOp, makeEcdsaModuleUserOp, makeEcdsaModuleUserOpWithPaymaster, signUserOp } from "../../src/utils/userOp";
import { TokenPaymaster } from "../../typechain-types";

describe("Token Paymaster", function () {
    let deployer: SignerWithAddress;
    let bundler: SignerWithAddress;
    let chainId: number;

    const setupTests = async () => {
        [deployer] = await ethers.getSigners();
        chainId = (await deployer.provider!.getNetwork()).chainId;
        if (chainId != 31337) {
            throw new Error("Only support hardhat network");
        }
        await deployments.fixture();
        const entryPoint = await getEntryPoint();
        const mockToken = await getMockToken();
        const luminexRouterV1 = await getLuminexRouterV1();
        const ecdsaModule = await getEcdsaOwnershipRegistryModule();
        const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");

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
            luminexRouterV1,
        };
    };
    it("Can execute transaction without paymaster ( use Native ) ", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule } = await setupTests();
        const userOp = await makeEcdsaModuleUserOp("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, {
            preVerificationGas: 50000,
        });
        const beneficiaryAddress = "0x".padEnd(42, "1");
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native amount before tranfer:", nativeInAA);
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        try {
            //console.log("Tx = ", (await tx.wait()).events!);
            console.log(" gas used  = ", formatEther((await tx.wait()).gasUsed.mul(100e9)));
        } catch (e) {
            console.log(" error sending Tx");
        }
        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log(" native amount after tranfer:", nativeInAA);
    });

    it("Can execute transaction with paymaster ( use wrapped native token )", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, wrappedNative } = await setupTests();
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
        console.log(" token amount before tranfer:", amountTokenInAA);
        console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
        const beneficiaryAddress = "0x".padEnd(42, "1");
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        const data = await tx.wait();

        // console.log(" logs = ", await ethers.provider.getTransactionReceipt(data.transactionHash));
        amountTokenInAA = formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals());
        const logs = data.events?.filter((event) => event.event === "Transfer");
        console.log(" token amount after tranfer:", amountTokenInAA);
        console.log(" balance of paymaster after tranfer ", formatEther((await entryPoint.getDepositInfo(paymaster.address)).deposit));
    });

    it("Auto fill paymaster with DEX", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, tokenPaymaster, luminexRouterV1 } = await setupTests();

        let config: TokenPaymaster.TokenPaymasterConfigStruct = {
            refundPostopCost: 40000,
            minSwapAmount: parseEther("0"),
        };

        //update config
        paymaster.setTokenPaymasterConfig(config);
        config = await paymaster.tokenPaymasterConfig();
        console.log(" config = ", config);

        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });

        await deployer.sendTransaction({
            to: luminexRouterV1.address,
            data: "0x",
            value: parseEther("1"),
        });

        let balanceNativeInLuminexDEX = Number(formatEther(await ethers.provider.getBalance(luminexRouterV1.address)));
        let balanceTokenInLuminexDEX = Number(formatUnits(await tokenPaymaster.balanceOf(luminexRouterV1.address), await tokenPaymaster.decimals()));
        console.log(" -- BEFORE -- ");
        console.log(" native balance in DEX = :", balanceNativeInLuminexDEX);
        console.log("  token balance in DEX = :", balanceTokenInLuminexDEX);
        let balanceNaviteInEntrypoint = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));
        let balanceNativeInPaymaster = Number(formatEther(await ethers.provider.getBalance(paymaster.address)));
        let balanceTokenInPaymaster = Number(formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals()));
        console.log(" native balance paymaster in Entrypoint : ", balanceNaviteInEntrypoint);
        console.log(" native balance in Paymaster = :", balanceNativeInPaymaster);
        console.log("  token balance in Paymaster = :", balanceTokenInPaymaster);

        let balanceNativeInUserSA = Number(formatEther(await ethers.provider.getBalance(userSA.address)));
        let balanceTokenInUserSA = Number(formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals()));
        console.log(" native balance in userSA = :", balanceNativeInUserSA);
        console.log("  token balance in userSA = :", balanceTokenInUserSA);
        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, tokenPaymaster, {
            preVerificationGas: 50000,
        });
        const beneficiaryAddress = "0x".padEnd(42, "1");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        const data = await tx.wait();

        console.log(" -- AFTER -- ");
        balanceNativeInLuminexDEX = Number(formatEther(await ethers.provider.getBalance(luminexRouterV1.address)));
        balanceTokenInLuminexDEX = Number(formatUnits(await tokenPaymaster.balanceOf(luminexRouterV1.address), await tokenPaymaster.decimals()));
        console.log(" native balance in DEX = :", balanceNativeInLuminexDEX);
        console.log("  token balance in DEX = :", balanceTokenInLuminexDEX);
        balanceNaviteInEntrypoint = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));
        balanceNativeInPaymaster = Number(formatEther(await ethers.provider.getBalance(paymaster.address)));
        balanceTokenInPaymaster = Number(formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals()));
        console.log(" native balance paymaster in Entrypoint : ", balanceNaviteInEntrypoint);
        console.log(" native balance in Paymaster = :", balanceNativeInPaymaster);
        console.log("  token balance in Paymaster = :", balanceTokenInPaymaster);

        balanceNativeInUserSA = Number(formatEther(await ethers.provider.getBalance(userSA.address)));
        balanceTokenInUserSA = Number(formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals()));
        console.log(" native balance in userSA = :", balanceNativeInUserSA);
        console.log("  token balance in userSA = :", balanceTokenInUserSA);
    });
});
