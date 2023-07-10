import { AtlasEnvironment } from "atlas-ide";
import * as deployPaymaster from "./deploy-paymaster";
import * as usePaymaster from "./use-paymaster";

export async function main(atlas: AtlasEnvironment) {
    const {
        erc20Address,
        greeterAddress,
        paymasterAddress,
        emptyWalletPk,
    } = await deployPaymaster.main(atlas);
    await usePaymaster.main(
        atlas,
        erc20Address,
        greeterAddress,
        paymasterAddress,
        emptyWalletPk
    )
}
