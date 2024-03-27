import { EntryPoint } from "@account-abstraction/contracts";
import { getEntryPoint } from "../src/utils/setupHelper";

describe("Test EntryPoint ", () => {
    let entrypoint: EntryPoint;

    const setupTests = async () => {
        entrypoint = await getEntryPoint();
    };

    before("setup test", async () => {
        await setupTests();
    });

    it("Deployed successfully", async () => {
        console.log(" entrypoint address =  ", entrypoint.address);
    });
});
