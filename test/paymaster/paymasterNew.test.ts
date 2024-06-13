import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getLuminexRouterV1, getMockPrivateWrapperFactory, getMockToken, getMockWrappedNative, getSmartAccountWithModule, getTokenPaymaster } from "../../src/utils/setupHelper";
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers/lib/utils";
import { makeEcdsaModuleUserOp, makeEcdsaModuleUserOpWithPaymaster, signUserOp } from "../../src/utils/userOp";
import { PrivateERC20__factory, TokenPaymaster } from "../../typechain-types";
import colors from "colors";

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
        const privateWrapperFactory = await getMockPrivateWrapperFactory();

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

        await privateWrapperFactory.createWrapper(mockToken.address);
        const privateTokenAddress = await privateWrapperFactory.wrappers(mockToken.address);

        await privateWrapperFactory.createWrapper(wrappedNative.address);
        const privateNativeAddress = await privateWrapperFactory.wrappers(wrappedNative.address);

        // get some private native for dex
        await wrappedNative.mint(deployer.address, parseEther("100"));
        await wrappedNative.approve(privateWrapperFactory.address, parseEther("50"));
        await privateWrapperFactory.wrapERC20(wrappedNative.address, parseEther("50"), deployer.address);
        const privateNative = PrivateERC20__factory.connect(privateNativeAddress, deployer);
        const privateToken = PrivateERC20__factory.connect(privateTokenAddress, deployer);
        await privateNative.transfer(luminexRouterV1.address, parseEther("50"));

        // update address private for DEX
        await luminexRouterV1.updatePrivateNative(privateNativeAddress);

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
            privateNative,
            privateToken,
        };
    };

    it("Can execute transaction without paymaster ( use Native ) ", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule } = await setupTests();
        const userOp = await makeEcdsaModuleUserOp("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, {
            preVerificationGas: 50000,
        });
        const beneficiaryAddress = "0x".padEnd(42, "1");
        let nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log("-- BEFORE --");
        console.log("native amount before tranfer:", colors.yellow(nativeInAA));
        console.log("-- EXECUTE --");
        let balanceBundler = formatEther(await ethers.provider.getBalance(deployer.address));
        console.log(" balance bundler before tranfer ", colors.yellow(balanceBundler));
        const tx = await entryPoint.connect(deployer).handleOps([userOp], deployer.address, { gasLimit: 15e6 });
        const data = await tx.wait();
        balanceBundler = formatEther(await ethers.provider.getBalance(deployer.address));
        console.log(" transaction gas ", data.gasUsed.toNumber());
        console.log(" balance bundler after tranfer ", colors.yellow(balanceBundler));
        nativeInAA = formatEther(await ethers.provider.getBalance(userSA.address));
        console.log("-- AFTER --");
        console.log("native amount after tranfer:", colors.yellow(nativeInAA));
        console.log("balance userSA in Entrypoint:", colors.yellow(formatEther(await entryPoint.balanceOf(userSA.address))));
    });

    it("Can execute transaction with paymaster ( use wrapped native token )", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, wrappedNative } = await setupTests();
        //deposit for paymaster
        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });
        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, wrappedNative, {
            preVerificationGas: 50000,
        });
        let wrappedNativeInAA = formatEther(await wrappedNative.balanceOf(userSA.address));
        let balanceNativePaymasterInEntryPoint = formatEther(await entryPoint.balanceOf(paymaster.address));
        let wrappedNativeInPaymaster = formatEther(await wrappedNative.balanceOf(paymaster.address));
        console.log("-- BEFORE --");
        console.log("wrappedNative of userSA: ", colors.yellow(wrappedNativeInAA));
        console.log("balance wrappedNative of paymaster: ", colors.yellow(wrappedNativeInPaymaster));
        console.log("balance of paymaster in Entrypoint: ", colors.yellow(balanceNativePaymasterInEntryPoint));
        const beneficiaryAddress = "0x".padEnd(42, "1");
        console.log("sending tx to entrypoint........");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 });
        console.log(" ⛽️ transaction gas ", (await tx.wait()).gasUsed.toNumber());
        wrappedNativeInAA = formatEther(await wrappedNative.balanceOf(userSA.address));
        balanceNativePaymasterInEntryPoint = formatEther(await entryPoint.balanceOf(paymaster.address));
        wrappedNativeInPaymaster = formatEther(await wrappedNative.balanceOf(paymaster.address));

        console.log("-- AFTER --");
        console.log("wrappedNative of userSA :", colors.yellow(wrappedNativeInAA));
        console.log("balance wrappedNative of paymaster: ", colors.yellow(wrappedNativeInPaymaster));
        console.log("balance of paymaster in Entrypoint:", colors.yellow(balanceNativePaymasterInEntryPoint));
    });

    it("Can execute transaction with paymaster ( use ERC-20 token) ", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, tokenPaymaster, privateNative, privateToken } = await setupTests();
        //deposit for paymaster
        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });

        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, tokenPaymaster, {
            preVerificationGas: 50000,
        });

        let amountTokenInAA = formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals());
        let amountTokenInPaymaster = formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals());
        let balanceNativePaymasterInEntryPoint = formatEther(await entryPoint.balanceOf(paymaster.address));
        console.log("token amount of userSA:", colors.yellow(amountTokenInAA));
        console.log("token amount of paymaster:", colors.yellow(amountTokenInPaymaster));
        console.log("balance of paymaster in Entrypoint:", colors.yellow(balanceNativePaymasterInEntryPoint));
        //console.log(" balance of paymaster after tranfer ", (await entryPoint.getDepositInfo(paymaster.address)).deposit);
        const beneficiaryAddress = "0x".padEnd(42, "1");
        console.log("sending tx to entrypoint........");
        const tx = await (await entryPoint.connect(deployer).handleOps([userOp], beneficiaryAddress, { gasLimit: 15e6 })).wait();
        console.log("transaction gas ", tx.gasUsed.toNumber());
        amountTokenInAA = formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals());
        amountTokenInPaymaster = formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals());
        balanceNativePaymasterInEntryPoint = formatEther(await entryPoint.balanceOf(paymaster.address));
        console.log("token amount of userSA: ", colors.yellow(amountTokenInAA));
        console.log("token amount of Paymaster: ", colors.yellow(amountTokenInPaymaster));
        console.log("balance of paymaster in entrypoint: ", colors.yellow(balanceNativePaymasterInEntryPoint));
    });

    it("Auto fill paymaster with DEX", async () => {
        const { userSA, callData, entryPoint, accountOwner, ecdsaModule, paymaster, tokenPaymaster, luminexRouterV1, privateNative, privateToken } = await setupTests();
        let config: TokenPaymaster.TokenPaymasterConfigStruct = {
            refundPostopCost: 40000,
            minSwapAmount: parseEther("0"),
        };
        //update config
        await paymaster.setTokenPaymasterConfig(config);
        config = await paymaster.tokenPaymasterConfig();

        await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("1") });
        await deployer.sendTransaction({
            to: luminexRouterV1.address,
            data: "0x",
            value: parseEther("0"),
        });
        let balancePrivateNativeInLuminexDEX = Number(formatEther(await privateNative.balanceOf(luminexRouterV1.address)));
        let balancePrivateTokenInLuminexDEX = Number(formatUnits(await privateToken.balanceOf(luminexRouterV1.address), await tokenPaymaster.decimals()));
        let balanceNaviteInEntrypoint = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));
        let balanceNativeInPaymaster = Number(formatEther(await ethers.provider.getBalance(paymaster.address)));
        let balanceTokenInPaymaster = Number(formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals()));
        let balanceTokenInUserSA = Number(formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals()));

        console.log(" -- BEFORE -- ");
        console.log("private native balance in DEX = :", balancePrivateNativeInLuminexDEX);
        console.log("private token balance in DEX = :", balancePrivateTokenInLuminexDEX);
        console.log("native balance paymaster in Entrypoint : ", balanceNaviteInEntrypoint);
        console.log("native balance in Paymaster = :", balanceNativeInPaymaster);
        console.log("token balance in Paymaster = :", balanceTokenInPaymaster);
        console.log("token balance in userSA = :", balanceTokenInUserSA);

        console.log(" -- EXECUTE -- ");
        const userOp = await makeEcdsaModuleUserOpWithPaymaster("execute", [deployer.address, 0, "0x"], userSA.address, deployer, entryPoint, ecdsaModule.address, paymaster, tokenPaymaster, {
            preVerificationGas: 50000,
        });
        let balanceBundler = formatEther(await ethers.provider.getBalance(deployer.address));
        console.log(" balance bundler before tranfer ", colors.yellow(balanceBundler));
        const beneficiaryAddress = "0x".padEnd(42, "1");
        const tx = await entryPoint.connect(deployer).handleOps([userOp], deployer.address, { gasLimit: 15e6 });
        const data = await tx.wait();
        balanceBundler = formatEther(await ethers.provider.getBalance(deployer.address));
        console.log(" transaction gas ", data.gasUsed.toNumber());
        console.log(" balance bundler before tranfer ", colors.yellow(balanceBundler));

        balancePrivateNativeInLuminexDEX = Number(formatEther(await privateNative.balanceOf(luminexRouterV1.address)));
        balancePrivateTokenInLuminexDEX = Number(formatUnits(await privateToken.balanceOf(luminexRouterV1.address), await tokenPaymaster.decimals()));
        balanceNaviteInEntrypoint = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));
        balanceNativeInPaymaster = Number(formatEther(await ethers.provider.getBalance(paymaster.address)));
        balanceTokenInPaymaster = Number(formatUnits(await tokenPaymaster.balanceOf(paymaster.address), await tokenPaymaster.decimals()));
        balanceTokenInUserSA = Number(formatUnits(await tokenPaymaster.balanceOf(userSA.address), await tokenPaymaster.decimals()));

        console.log("-- AFTER -- ");
        console.log("private native balance in DEX = :", balancePrivateNativeInLuminexDEX);
        console.log("private token balance in DEX = :", balancePrivateTokenInLuminexDEX);
        console.log("native balance paymaster in Entrypoint : ", balanceNaviteInEntrypoint);
        console.log("native balance in Paymaster = :", balanceNativeInPaymaster);
        console.log("token balance in Paymaster = :", balanceTokenInPaymaster);
        console.log("token balance in userSA = :", balanceTokenInUserSA);
    });
});
