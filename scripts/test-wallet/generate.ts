/**
 * Prints fresh test wallets.
 *
 *   bun scripts/test-wallet/generate.ts [count]
 *
 * To stdout only. Nothing is written to disk, because a private key in a file is a private key that
 * outlives the reason it was made — and this repo's .gitignore protects .env* but not a stray
 * keys.json. If one has to be kept, put it in a gitignored .dev.vars or .env file yourself, and
 * still treat it as burned.
 */
import { generateTestWallet } from "./wallet";

const count = Math.min(Math.max(Number.parseInt(process.argv[2] ?? "1", 10) || 1, 1), 20);

console.log("TEST WALLETS — never fund these, never reuse them, never commit them.");
console.log("Safe for querying public read endpoints with an address nobody has used.\n");

for (let i = 0; i < count; i++) {
  const wallet = generateTestWallet();
  if (count > 1) console.log(`# ${i + 1}`);
  console.log(`address     ${wallet.address}`);
  console.log(`public key  ${wallet.publicKey}`);
  console.log(`private key ${wallet.privateKey}\n`);
}
