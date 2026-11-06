import { config } from "./config.js";
import { buildDlc } from "./sign.js";
import { toWire } from "./frameTx/wire.js";
import { validationGas } from "./frameTx/send.js";
import { getTransactionReceipt, rpc } from "./rpc.js";
import { readState } from "./state.js";

async function main(): Promise<void> {
  const state = readState();
  const checkout = await buildDlc();

  console.log("ethrex_simulateFrameTransaction (root URL)");
  try {
    const simulated = await rpc(config.rootUrl, "ethrex_simulateFrameTransaction", [toWire(checkout.no.tx)]);
    console.log(JSON.stringify(simulated, null, 2));
  } catch (error) {
    console.log(`simulation unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!state.dlcTxHash) {
    console.log("no promoted DLC transaction in the state; run yarn demo:dlc first");
    return;
  }

  const receipt = await getTransactionReceipt(state.dlcTxHash);
  if (!receipt) {
    console.log(`receipt for ${state.dlcTxHash} not found`);
    return;
  }

  const validationGasWei = validationGas(receipt);
  const included = BigInt(receipt.blockNumber);

  console.log("");
  console.log("measured from the receipt");
  console.log(`  promoted tx      ${state.dlcTxHash}`);
  console.log(`  validation gas   ${validationGasWei}`);
  console.log(`  included block   ${included.toString()}`);
  if (state.dlcAttestBlock) {
    console.log(`  attest block     ${state.dlcAttestBlock}`);
    console.log(`  attest -> include ${(included - BigInt(state.dlcAttestBlock)).toString()} blocks`);
  }
  if (state.dlcGas) console.log(`  stored gas       ${state.dlcGas}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
