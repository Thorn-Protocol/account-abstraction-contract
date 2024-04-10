import { Wallet } from "ethers";
import { Provider } from "../config/constants";
import ContractAddress from "../config/contracts";
import { ECDSAModule__factory, SmartAccountFactory__factory } from "../../typechain-types";

const factory = SmartAccountFactory__factory.connect(ContractAddress.SmartAccountFactory, Provider)

function getECDSASetupdata(smartAccountOwner: string) {
    return ECDSAModule__factory.createInterface().encodeFunctionData(
        "initForSmartAccount",
        [smartAccountOwner]
    );
}

export async function getFirstSAs(smartAccountOwner: string, number: number) {
    let result = [];
    for (let index = 0; index < number; index++) {
        const sa = await factory.getAddressForCounterFactualAccount(
            ContractAddress.SwapSessionKeyManager,
            ContractAddress.ECDSAModule,
            getECDSASetupdata(smartAccountOwner),
            index
        )
        result.push(sa)
    }
    return result
}

export async function deployFirstSAs(smartAccountOwner: Wallet, number: number) {
    const tx = await factory.connect(smartAccountOwner).deployMultipleCounterFactualAccounts(
        ContractAddress.SwapSessionKeyManager,
        ContractAddress.ECDSAModule,
        getECDSASetupdata(smartAccountOwner.address),
        [...Array(number).keys()]
    )
    await tx.wait()
}