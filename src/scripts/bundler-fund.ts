import dotenv from "dotenv";
import { providers, Wallet } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";

import HDKey from "hdkey";
import { SmartAccountClient } from "thorn-aa-sdk";

dotenv.config();

async function fund() {
  const seed = process.env.SEED;
  const amount_wallet = 100;
  const wallets = [];
  const hdkey = HDKey.fromMasterSeed(Buffer.from(seed!, "hex"));
  const provider = new providers.JsonRpcProvider("https://testnet.sapphire.oasis.io/");

  for (let i = 0; i < amount_wallet; i++) {
    const child = hdkey.derive(`m/44'/60'/0'/0/${i}`);
    const child_wallet = new Wallet(child.privateKey, provider);
    wallets.push({
      index: i,
      value: child_wallet,
    });
  }
  const listLowBalance: any[] = [];
  await Promise.all(
    wallets.map(async (e) => {
      console.log("  ", await e.value.getAddress());
      const balance = Number(formatEther(await provider.getBalance(await e.value.getAddress())));

      if (balance < 0.5) {
        listLowBalance.push(e);
      }
    })
  );

  console.log(" amount need fund = ", listLowBalance.length);

  const CFO_wallet = new Wallet(process.env.CFO_PRIVATE_KEY!, provider);
  listLowBalance.sort((a, b) => a.index - b.index);
  for (let i = 0; i < listLowBalance.length; i++) {
    const tx = {
      to: await listLowBalance[i].value.getAddress(),
      data: "0x",
      value: parseEther("1"),
    };
    const signedTx = await CFO_wallet.sendTransaction(tx);
    await signedTx.wait();
    console.log(" fund for wallet ", listLowBalance[i].index, " success");
  }
  const balances: any = [];
  await Promise.all(
    wallets.map(async (e) => {
      console.log("  ", await e.value.getAddress());
      const balance = Number(formatEther(await provider.getBalance(await e.value.getAddress())));

      // console.log(" wallet ", e.index, " balance ", balance.toFixed(2));
      balances.push({
        index: e.index,
        value: e.value,
        balance,
      });
    })
  );

  balances.sort((a: any, b: any) => a.index - b.index);

  for (let i = 0; i < balances.length; i++) {
    console.log(" wallet ", balances[i].index, " balance ", balances[i].balance.toFixed(2));
  }
}

fund();
