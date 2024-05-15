import dotenv from "dotenv";
import { providers, Wallet } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";

import HDKey from "hdkey";
import { SmartAccountClient } from "thorn-aa-sdk";

dotenv.config();

async function stressTest() {
  const wallet_atk: {
    index: number;
    value: Wallet;
  }[] = [];
  const userSA_atk: any[] = [];
  const seed = process.env.SEED_STRESS;
  const amount_atk = 20;
  const hdkey = HDKey.fromMasterSeed(Buffer.from(seed!, "hex"));
  const provider = new providers.JsonRpcProvider("https://nd-474-244-762.p2pify.com/47c2d0edc8445a9f5e2204c58e85af4a");

  console.log(" config ......");

  for (let i = 0; i < amount_atk; i++) {
    const child = hdkey.derive(`m/44'/60'/0'/0/${i}`);
    const child_wallet = new Wallet(child.privateKey, provider);
    wallet_atk.push({
      index: i,
      value: child_wallet,
    });
  }

  await Promise.all(
    wallet_atk.map(async (e) => {
      const user_SA = await SmartAccountClient.create({
        eoaSigner: e.value,
        chainId: 23295,
        bundlerUrl: "http://0.0.0.0:14337/rpc",
      });
      userSA_atk.push({
        index: e.index,
        value: user_SA,
      });
    })
  );

  const CFO_wallet = new Wallet(process.env.CFO_PRIVATE_KEY!, provider);

  console.log(" check balance ...... eoa wallets ");

  const listEoaWalletNeedFund: any[] = [];

  await Promise.all(
    wallet_atk.map(async (e) => {
      const balance = Number(formatEther(await provider.getBalance(await e.value.getAddress())));
      if (balance < 0.1) {
        listEoaWalletNeedFund.push(e);
      }
    })
  );

  console.log(" amount eoa wallet need fund = ", listEoaWalletNeedFund.length);

  listEoaWalletNeedFund.sort((a, b) => a.index - b.index);

  for (let i = 0; i < listEoaWalletNeedFund.length; i++) {
    const tx = {
      to: await listEoaWalletNeedFund[i].value.getAddress(),
      data: "0x",
      value: parseEther("0.1"),
    };
    const signedTx = await CFO_wallet.sendTransaction(tx);
    await signedTx.wait();
    console.log(" fund for wallet ", listEoaWalletNeedFund[i].index, " success");
  }

  console.log(" check deployment ... userSA accounts ");

  await Promise.all(
    userSA_atk.map(async (e) => {
      if ((await e.value.isAccountDeployed()) == false) {
        const tx = await e.value.deploy();
        const eoaWallet = wallet_atk[e.index].value;
        const signedTx = (await eoaWallet.sendTransaction(tx)).wait();
        console.log(" DEBUG :: Deploy smart account ", e.index, " address ", await e.value.getAddress());
      }
    })
  );

  console.log(" checking balance ... userSA accounts");

  const listAAWalletNeedFund: any[] = [];

  await Promise.all(
    userSA_atk.map(async (e) => {
      const balance = Number(formatEther(await provider.getBalance(await e.value.getAddress())));
      if (balance < 0.3) {
        listAAWalletNeedFund.push(e);
      }
    })
  );

  console.log(" amount userSA account need fund = ", listAAWalletNeedFund.length);

  listAAWalletNeedFund.sort((a, b) => a.index - b.index);

  for (let i = 0; i < listAAWalletNeedFund.length; i++) {
    const tx = {
      to: await listAAWalletNeedFund[i].value.getAddress(),
      data: "0x",
      value: parseEther("0.5"),
    };
    const signedTx = await CFO_wallet.sendTransaction(tx);
    await signedTx.wait();
    console.log(" fund for userSA account ", listAAWalletNeedFund[i].index, " success");
  }

  console.log(" now Attack ...");
  //return;
  let index = 0;
  const tx = {
    to: CFO_wallet.address,
    data: "0x",
    value: 0,
  };
  console.log(" start attack ... ");
  userSA_atk.map(async (e) => {
    try {
      console.time(`🚀🚀 ----------------------------------  attack :: ${await e.value.getAddress()}`);
      const data = await e.value.buildUserOpSignAndSend([tx]);
      const data2 = await data.wait();
      index++;
      console.log(`id ${index}`, data2.success, " ", data2.receipt.transactionHash);

      console.timeEnd(`🚀🚀 ----------------------------------  attack :: ${await e.value.getAddress()}`);
    } catch (e) {
      console.log(" error :: ", e);
    }
  });
}

stressTest();
