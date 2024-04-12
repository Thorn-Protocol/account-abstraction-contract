import { AbiCoder, Interface, defaultAbiCoder, formatEther, parseEther } from "ethers/lib/utils";
import {
    EntryPoint,
    EntryPoint__factory,
    SimpleAccount,
    SimpleAccountFactory,
    SimpleAccountFactory__factory,
    TestERC20,
    TestERC20__factory,
    PrivateERC20,
    PrivateERC20__factory,
    TestQuoterV2,
    TestQuoterV2__factory,
    TestUniswapRoute,
    TestUniswapRoute__factory,
    TestWrappedNativeToken,
    TestWrappedNativeToken__factory,
    TokenPaymaster,
    TokenPaymaster__factory,
} from "../../typechain-types";

import { UniswapHelper as UniswapHelperNamespace } from "../../typechain-types/contracts/smart-account/paymasters/TokenPaymaster";

import { BigNumber, Wallet, utils } from "ethers";
import { checkForGeth, createAccount, createAccountOwner, decodeRevertReason, deployEntryPoint, fund, packPaymasterData } from "../testutils";
import { ethers } from "hardhat";
import { assert, expect } from "chai";
import { fillUserOp, signUserOp } from "../utils/userOp";
import {} from "../utils/userOp";

function uniq(arr: any[]): any[] {
    // remove items with duplicate "name" attribute
    return Object.values(arr.reduce((set, item) => ({ ...set, [item.name]: item }), {}));
}

describe("TokenPaymaster", function () {
    const initialPriceToken = 100000000;
    const initialPriceEther = 1;
    const ethersSigner = ethers.provider.getSigner();
    const beneficiaryAddress = "0x".padEnd(42, "1");
    const testInterface = new Interface(uniq([...TestUniswapRoute__factory.abi, ...TestERC20__factory.abi, ...TokenPaymaster__factory.abi, ...EntryPoint__factory.abi]));

    let chainId: number;
    let testUniswapRoute: TestUniswapRoute;
    let testUniswapQuote: TestQuoterV2;
    let entryPoint: EntryPoint;
    let accountOwner: Wallet;
    //let tokenOracle: TestOracle2;
    // let nativeAssetOracle: TestOracle2;
    let account: SimpleAccount;
    let factory: SimpleAccountFactory;
    let paymasterAddress: string;
    let paymaster: TokenPaymaster;
    let paymasterOwner: string;
    let callData: string;
    let token: TestERC20;
    let privateToken: PrivateERC20;

    let weth: TestWrappedNativeToken;

    before(async function () {
        entryPoint = await deployEntryPoint();
        weth = await new TestWrappedNativeToken__factory(ethersSigner).deploy();
        testUniswapRoute = await new TestUniswapRoute__factory(ethersSigner).deploy(weth.address);

        testUniswapQuote = await new TestQuoterV2__factory(ethersSigner).deploy(weth.address);

        factory = await new SimpleAccountFactory__factory(ethersSigner).deploy(entryPoint.address);

        accountOwner = createAccountOwner();
        chainId = (await accountOwner.provider.getNetwork()).chainId;
        const { proxy } = await createAccount(ethersSigner, await accountOwner.getAddress(), entryPoint.address, factory);
        account = proxy;
        console.log("account", account.address);
        await fund(account);
        console.log("A");
        await checkForGeth();
        token = await new TestERC20__factory(ethersSigner).deploy(6);
        await weth.deposit({ value: parseEther("10") });
        await weth.transfer(testUniswapRoute.address, parseEther("1"));
        console.log("A");
        paymasterOwner = await ethersSigner.getAddress();
        const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
            refundPostopCost: 40000,
            minSwapAmount: parseEther("0.005"),
        };
        console.log("A");
        const uniswapHelperConfig: UniswapHelperNamespace.UniswapHelperConfigStruct = {
            minSwapAmount: parseEther("0.005"),
            slippage: 0,
        };
        console.log("A");
        paymaster = await new TokenPaymaster__factory(ethersSigner).deploy(entryPoint.address, weth.address, testUniswapRoute.address, testUniswapQuote.address, tokenPaymasterConfig, uniswapHelperConfig, paymasterOwner);
        paymasterAddress = paymaster.address;
        console.log("A");
        //await token.transfer(paymaster.address, 100);
        await entryPoint.depositTo(paymaster.address, { value: parseEther("10") });
        await paymaster.addStake(1, { value: parseEther("2") });
        console.log("A");
        console.log("account", account.address);
        callData = await account.populateTransaction.execute(accountOwner.address, 0, "0x").then((tx) => tx.data!);
    });

    // it("Only owner should withdraw eth from paymaster to destination", async function () {
    //     const recipient = accountOwner.address;
    //     const amount = (2e18).toString();
    //     const balanceBefore = await ethers.provider.getBalance(paymasterAddress);
    //     await fund(paymasterAddress, "2");
    //     const balanceAfter = await ethers.provider.getBalance(paymasterAddress);
    //     assert.equal(balanceBefore.add(BigNumber.from(amount)).toString(), balanceAfter.toString());

    //     const impersonatedSigner = await ethers.getImpersonatedSigner("0x1234567890123456789012345678901234567890");
    //     const paymasterDifferentSigner = TokenPaymaster__factory.connect(paymasterAddress, impersonatedSigner);

    //     // should revert for non owner
    //     await expect(paymasterDifferentSigner.withdrawEth(paymasterOwner, amount)).to.be.revertedWith("Ownable: caller is not the owner");

    //     // should revert if the transfer fails
    //     await expect(paymaster.withdrawEth(recipient, BigNumber.from(amount).mul(2))).to.be.revertedWith("withdraw failed");

    //     const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    //     await paymaster.withdrawEth(recipient, balanceAfter);
    //     const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
    //     assert.equal(recipientBalanceBefore.add(BigNumber.from(amount)).toString(), recipientBalanceAfter.toString());
    // });
    // it("paymaster should reject if postOpGaSLimit is too low", async () => {
    //    const snapshot = await ethers.provider.send("evm_snapshot", []);
    //     const config = await paymaster.tokenPaymasterConfig();
    //     console.log("before sign", account.address);
    //     let op = await fillUserOp(
    //         {
    //             sender: account.address,
    //             paymasterAndData: packPaymasterData(paymasterAddress, 3e5, config.refundPostopCost - 1, weth.address),
    //             callData,
    //         },
    //         entryPoint
    //     );
    //     console.log("before sign");
    //     op = signUserOp(op, accountOwner, entryPoint.address, chainId);
    //     console.log("op",);
     
    //     expect(await entryPoint.handleOps([op], beneficiaryAddress, { gasLimit: 1e7 }).catch((e) => decodeRevertReason(e))).to.match(/TPM: postOpGasLimit too low/);

    //     await ethers.provider.send("evm_revert", [snapshot]);
    // });
    it("should be able to sponsor the UserOp while charging correct amount of wrapped native tokens", async () => {
        const snapshot = await ethers.provider.send("evm_snapshot", []);

        await weth.transfer(account.address, parseEther("1"));
        await weth.sudoApprove(account.address, paymaster.address, ethers.constants.MaxUint256);

        let op = await fillUserOp(
            {
                sender: account.address,
                paymasterAndData: packPaymasterData(paymasterAddress, 3e5, 3e5, weth.address),
                callData,
            },
            entryPoint
        );
        const hash = defaultAbiCoder.encode(["address"], [weth.address]);
        op = signUserOp(op, accountOwner, entryPoint.address, chainId);
        console.log("op", op);
        console.log("ether " , utils.hexlify(op.maxFeePerGas));
        await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"]);
       await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [utils.hexlify(op.maxFeePerGas)]);
        const tx = await entryPoint
            .handleOps([op], beneficiaryAddress, {
                gasLimit: 3e7,
                maxFeePerGas: op.maxFeePerGas,
                maxPriorityFeePerGas: op.maxFeePerGas,
            })
            .then(async (tx) => await tx.wait());

        const decodedLogs = tx.logs.map((it) => {
            return testInterface.parseLog(it);
        });
        const preChargeTokens = decodedLogs[0].args.value;
        const refundTokens = decodedLogs[2].args.value;
        const actualTokenChargeEvents = preChargeTokens.sub(refundTokens);
        const actualTokenCharge = decodedLogs[3].args.actualTokenCharge;
        const actualGasCostPaymaster = decodedLogs[3].args.actualGasCost;
        const actualGasCostEntryPoint = decodedLogs[4].args.actualGasCost;
        const addedPostOpCost = BigNumber.from(op.maxFeePerGas).mul(40000);

        // note: as price is in ether-per-token, and we want more tokens, increasing it means dividing it by markup

        const expectedWeiCharge = actualGasCostPaymaster.add(addedPostOpCost);
        const postOpGasCost = actualGasCostEntryPoint.sub(actualGasCostPaymaster);
        assert.equal(decodedLogs.length, 5);
        assert.equal(decodedLogs[4].args.success, true);
        assert.equal(actualTokenChargeEvents.toString(), actualTokenCharge.toString());
        assert.equal(actualTokenChargeEvents.toString(), expectedWeiCharge.toString());
        assert.closeTo(postOpGasCost.div(tx.effectiveGasPrice).toNumber(), 20000, 20000);
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it("should be able to sponsor the UserOp while charging correct amount of ERC-20 tokens", async () => {
        const snapshot = await ethers.provider.send("evm_snapshot", []);

        await paymaster.connect(ethersSigner).addERC20Support(token.address, 500);
        await token.transfer(account.address, parseEther("1"));
        await token.sudoApprove(account.address, paymaster.address, ethers.constants.MaxUint256);

        let op = await fillUserOp(
            {
                sender: account.address,
                paymasterAndData: packPaymasterData(paymasterAddress, 3e5, 3e5, token.address),
                callData,
            },
            entryPoint
        );
        const hash = defaultAbiCoder.encode(["address"], [weth.address]);
        op = signUserOp(op, accountOwner, entryPoint.address, chainId);
        await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [utils.hexlify(op.maxFeePerGas)]);
        const tx = await entryPoint
            .handleOps([op], beneficiaryAddress, {
                gasLimit: 3e7,
                maxFeePerGas: op.maxFeePerGas,
                maxPriorityFeePerGas: op.maxFeePerGas,
            })
            .then(async (tx) => await tx.wait());

        const decodedLogs = tx.logs.map((it) => {
            return testInterface.parseLog(it);
        });

        const preChargeTokens = decodedLogs[0].args.value;

        const refundTokens = decodedLogs[2].args.value;

        const actualTokenChargeEvents = preChargeTokens.sub(refundTokens);

        const actualTokenCharge = decodedLogs[3].args.actualTokenCharge;
        const actualGasCostPaymaster = decodedLogs[3].args.actualGasCost;
        const actualGasCostEntryPoint = decodedLogs[3].args.actualGasCost;
        //console.log(decodedLogs);

        const addedPostOpCost = BigNumber.from(op.maxFeePerGas).mul(40000);
        // // note: as price is in ether-per-token, and we want more tokens, increasing it means dividing it by markup
        const expectedWeiCharge = actualGasCostPaymaster.add(addedPostOpCost);
        const postOpGasCost = actualGasCostEntryPoint.sub(actualGasCostPaymaster);
        assert.equal(decodedLogs.length, 5);
        assert.equal(decodedLogs[4].args.success, true);
        assert.equal(actualTokenChargeEvents.toString(), actualTokenCharge.toString());
        //assert.equal(actualTokenChargeEvents.toString(), expectedWeiCharge.toString());
        assert.closeTo(postOpGasCost.div(tx.effectiveGasPrice).toNumber(), 20000, 20000);
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it("should swap wrapped native eth for ether if it falls below configured value and deposit it", async () => {
        const snapshot = await ethers.provider.send("evm_snapshot", []);

        await weth.transfer(account.address, parseEther("1"));
        await weth.sudoApprove(account.address, paymaster.address, ethers.constants.MaxUint256);
        await token.transfer(account.address, 1e6);
        await weth.transfer(paymaster.address, parseEther("0.005"));

        let op = await fillUserOp(
            {
                sender: account.address,
                paymasterAndData: packPaymasterData(paymasterAddress, 3e5, 3e5, weth.address),
                callData,
            },
            entryPoint
        );
        const hash = defaultAbiCoder.encode(["address"], [weth.address]);
        op = signUserOp(op, accountOwner, entryPoint.address, chainId);
        await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [utils.hexlify(op.maxFeePerGas)]);
        const tx = await entryPoint
            .handleOps([op], beneficiaryAddress, {
                gasLimit: 3e7,
                maxFeePerGas: op.maxFeePerGas,
                maxPriorityFeePerGas: op.maxFeePerGas,
            })
            .then(async (tx) => await tx.wait());

        const decodedLogs = tx.logs.map((it) => {
            return testInterface.parseLog(it);
        });
        const preChargeTokens = decodedLogs[0].args.value;
        const refundTokens = decodedLogs[2].args.value;
        const actualTokenChargeEvents = preChargeTokens.sub(refundTokens);
        const actualTokenCharge = decodedLogs[3].args.actualTokenCharge;
        const actualGasCostPaymaster = decodedLogs[3].args.actualGasCost;
        const actualGasCostEntryPoint = decodedLogs[4].args.actualGasCost;
        const addedPostOpCost = BigNumber.from(op.maxFeePerGas).mul(40000);
        //console.log(" decode ", decodedLogs);
        // note: it is hard to deploy Uniswap on hardhat - so stubbing it for the unit test
        assert.equal(decodedLogs[5].name, "Received");
        assert.equal(decodedLogs[6].name, "Deposited");
        assert.equal(decodedLogs[5].args.value.toString(), actualTokenCharge.add(parseEther("0.005")).toString());
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it("should swap ERC-20 token  for ether if it falls below configured value and deposit it", async () => {
        const snapshot = await ethers.provider.send("evm_snapshot", []);
        await paymaster.connect(ethersSigner).addERC20Support(token.address, 500);
        await weth.transfer(paymaster.address, parseEther("1"));
        await token.sudoApprove(account.address, paymaster.address, ethers.constants.MaxUint256);
        await token.sudoApprove(paymaster.address, testUniswapRoute.address, ethers.constants.MaxUint256);
        await token.transfer(account.address, 1e6);
        await token.transfer(paymaster.address, 0.5 * 1e6);

        let op = await fillUserOp(
            {
                sender: account.address,
                paymasterAndData: packPaymasterData(paymasterAddress, 3e5, 3e5, token.address),
                callData,
            },
            entryPoint
        );
        const hash = defaultAbiCoder.encode(["address"], [weth.address]);
        op = signUserOp(op, accountOwner, entryPoint.address, chainId);
        await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [utils.hexlify(op.maxFeePerGas)]);
        const tx = await entryPoint
            .handleOps([op], beneficiaryAddress, {
                gasLimit: 3e7,
                maxFeePerGas: op.maxFeePerGas,
                maxPriorityFeePerGas: op.maxFeePerGas,
            })
            .then(async (tx) => await tx.wait());

        const decodedLogs = tx.logs.map((it) => {
            return testInterface.parseLog(it);
        });
        const preChargeTokens = decodedLogs[0].args.value;
        const refundTokens = decodedLogs[2].args.value;
        const actualTokenChargeEvents = preChargeTokens.sub(refundTokens);
        const actualTokenCharge = decodedLogs[3].args.actualTokenCharge;
        const actualGasCostPaymaster = decodedLogs[3].args.actualGasCost;
        const actualGasCostEntryPoint = decodedLogs[4].args.actualGasCost;
        const addedPostOpCost = BigNumber.from(op.maxFeePerGas).mul(40000);
        assert.equal(decodedLogs[8].name, "Received");
        assert.equal(decodedLogs[9].name, "Deposited");
        assert.equal(decodedLogs[6].args.value.sub(5).toString(), actualTokenCharge.mul(1e10).add(parseEther("0.005")).toString());

        await ethers.provider.send("evm_revert", [snapshot]);
    });
});
