import { ethers } from "hardhat";
import { Create2Factory } from "../src/Create2Factory";
import { EntryPoint, EntryPoint__factory, SimpleAccount, SimpleAccountFactory, SimpleAccountFactory__factory, SimpleAccount__factory, TestERC20__factory, TestPaymasterRevertCustomError__factory } from "../typechain-types";
import { BytesLike, Hexable, Interface, arrayify, hexZeroPad, hexlify, keccak256, parseEther } from "ethers/lib/utils";
import { BigNumber, Contract, Signer, Wallet } from "ethers";
// import {} from "../utils/testUtils";

export const AddressZero = ethers.constants.AddressZero;
export const HashZero = ethers.constants.HashZero;

export async function deployEntryPoint(provider = ethers.provider): Promise<EntryPoint> {
    const create2factory = new Create2Factory(provider);
    const addr = await create2factory.deploy(EntryPoint__factory.bytecode, process.env.SALT, process.env.COVERAGE != null ? 20e6 : 8e6);
    return EntryPoint__factory.connect(addr, provider.getSigner());
}

let counter = 0;

// create non-random account, so gas calculations are deterministic
export function createAccountOwner(): Wallet {
    const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))));
    return new ethers.Wallet(privateKey, ethers.provider);
    // return new ethers.Wallet('0x'.padEnd(66, privkeyBase), ethers.provider);
}

// Deploys an implementation and a proxy pointing to this implementation
export async function createAccount(
    ethersSigner: Signer,
    accountOwner: string,
    entryPoint: string,
    _factory?: SimpleAccountFactory
): Promise<{
    proxy: SimpleAccount;
    accountFactory: SimpleAccountFactory;
    implementation: string;
}> {
    const accountFactory = _factory ?? (await new SimpleAccountFactory__factory(ethersSigner).deploy(entryPoint));
    const implementation = await accountFactory.accountImplementation();
    await accountFactory.createAccount(accountOwner, 0);
    const accountAddress = await accountFactory.getAddress(accountOwner, 0);
    const proxy = SimpleAccount__factory.connect(accountAddress, ethersSigner);
    return {
        implementation,
        accountFactory,
        proxy,
    };
}

// just throw 1eth from account[0] to the given address (or contract instance)
export async function fund(contractOrAddress: string | Contract, amountEth = "1"): Promise<void> {
    let address: string;
    if (typeof contractOrAddress === "string") {
        address = contractOrAddress;
    } else {
        address = contractOrAddress.address;
    }
    await ethers.provider.getSigner().sendTransaction({ to: address, value: parseEther(amountEth) });
}

let currentNode: string = "";

// basic geth support
// - by default, has a single account. our code needs more.
export async function checkForGeth(): Promise<void> {
    // @ts-ignore
    const provider = ethers.provider._hardhatProvider;

    currentNode = await provider.request({ method: "web3_clientVersion" });

    console.log("node version:", currentNode);
    // NOTE: must run geth with params:
    // --http.api personal,eth,net,web3
    // --allow-insecure-unlock
    if (currentNode.match(/geth/i) != null) {
        for (let i = 0; i < 2; i++) {
            const acc = await provider.request({ method: "personal_newAccount", params: ["pass"] }).catch(rethrow);
            await provider.request({ method: "personal_unlockAccount", params: [acc, "pass"] }).catch(rethrow);
            await fund(acc, "10");
        }
    }
}

// rethrow "cleaned up" exception.
// - stack trace goes back to method (or catch) line, not inner provider
// - attempt to parse revert data (needed for geth)
// use with ".catch(rethrow())", so that current source file/line is meaningful.
export function rethrow(): (e: Error) => void {
    const callerStack = new Error().stack!.replace(/Error.*\n.*at.*\n/, "").replace(/.*at.* \(internal[\s\S]*/, "");

    if (arguments[0] != null) {
        throw new Error("must use .catch(rethrow()), and NOT .catch(rethrow)");
    }
    return function (e: Error) {
        const solstack = e.stack!.match(/((?:.* at .*\.sol.*\n)+)/);
        const stack = (solstack != null ? solstack[1] : "") + callerStack;
        // const regex = new RegExp('error=.*"data":"(.*?)"').compile()
        const found = /error=.*?"data":"(.*?)"/.exec(e.message);
        let message: string;
        if (found != null) {
            const data = found[1];
            message = decodeRevertReason(data) ?? e.message + " - " + data.slice(0, 100);
        } else {
            message = e.message;
        }
        const err = new Error(message);
        err.stack = "Error: " + message + "\n" + stack;
        throw err;
    };
}

export function callDataCost(data: string): number {
    return ethers.utils
        .arrayify(data)
        .map((x) => (x === 0 ? 4 : 16))
        .reduce((sum, x) => sum + x);
}

export function packPaymasterData(paymaster: string, paymasterVerificationGasLimit: BytesLike | Hexable | number | bigint, postOpGasLimit: BytesLike | Hexable | number | bigint, paymasterData: string): string {
    return ethers.utils.hexConcat([paymaster, hexZeroPad(hexlify(paymasterVerificationGasLimit, { hexPad: "left" }), 16), hexZeroPad(hexlify(postOpGasLimit, { hexPad: "left" }), 16), paymasterData]);
}

const decodeRevertReasonContracts = new Interface([
    ...EntryPoint__factory.createInterface().fragments,
    ...TestPaymasterRevertCustomError__factory.createInterface().fragments,
    ...TestERC20__factory.createInterface().fragments, // for OZ errors,
    "error ECDSAInvalidSignature()",
]); // .filter(f => f.type === 'error'))

const panicCodes: { [key: number]: string } = {
    // from https://docs.soliditylang.org/en/v0.8.0/control-structures.html
    0x01: "assert(false)",
    0x11: "arithmetic overflow/underflow",
    0x12: "divide by zero",
    0x21: "invalid enum value",
    0x22: "storage byte array that is incorrectly encoded",
    0x31: ".pop() on an empty array.",
    0x32: "array sout-of-bounds or negative index",
    0x41: "memory overflow",
    0x51: "zero-initialized variable of internal function type",
};

export function decodeRevertReason(data: string | Error, nullIfNoMatch = true): string | null {
    if (typeof data !== "string") {
        const err = data as any;
        data = (err.data ?? err.error?.data) as string;
        if (typeof data !== "string") throw err;
    }

    const methodSig = data.slice(0, 10);
    const dataParams = "0x" + data.slice(10);

    // can't add Error(string) to xface...
    if (methodSig === "0x08c379a0") {
        const [err] = ethers.utils.defaultAbiCoder.decode(["string"], dataParams);
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `Error(${err})`;
    } else if (methodSig === "0x4e487b71") {
        const [code] = ethers.utils.defaultAbiCoder.decode(["uint256"], dataParams);
        return `Panic(${panicCodes[code] ?? code} + ')`;
    }

    try {
        const err = decodeRevertReasonContracts.parseError(data);
        // treat any error "bytes" argument as possible error to decode (e.g. FailedOpWithRevert, PostOpReverted)
        const args = err.args.map((arg: any, index) => {
            switch (err.errorFragment.inputs[index].type) {
                case "bytes":
                    return decodeRevertReason(arg);
                case "string":
                    return `"${arg as string}"`;
                default:
                    return arg;
            }
        });
        return `${err.name}(${args.join(",")})`;
    } catch (e) {
        // throw new Error('unsupported errorSig ' + data)
        if (!nullIfNoMatch) {
            return data;
        }
        return null;
    }
}
