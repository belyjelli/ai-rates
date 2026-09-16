import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/**
 * Fresh EVM keypairs, for testing the venue queries that need an account identity.
 *
 * Why this exists: nothing in this repo has ever held a wallet. Every adapter reads public
 * endpoints, so no address, key or signature was needed. The account-scoped queries do need one —
 * Hyperliquid's `userFees` takes a master address (plans/member-fee-settings.md) — and there is no
 * address to test with. Generating one is the honest way to get there: the alternative is pasting a
 * stranger's address from a block explorer, which tests someone else's account, or inventing a
 * plausible-looking hex string, which is not a valid point on the curve and fails differently than
 * production would.
 *
 * ## These keys are for tests. Never fund them.
 *
 * A key printed to a terminal, kept in a scratch file or pasted into a chat is compromised the
 * moment it exists. Everything here is safe for querying PUBLIC read endpoints with an address
 * nobody has used. None of it is safe for custody of anything.
 *
 * ## Why a dependency, in a repo that has no runtime dependencies
 *
 * Measured, not assumed: Bun's CryptoHasher has no `keccak256` (only `sha3-*`), and Bun's
 * `node:crypto` rejects secp256k1 outright as UNKNOWN_GROUP. Ethereum's keccak-256 is NOT SHA3-256 —
 * they differ in padding, so substituting `sha3-256` yields well-formed addresses that are simply
 * wrong, and no test comparing the code against itself would notice. @noble/curves and
 * @noble/hashes are audited, dependency-free, and are what viem and ethers use underneath. They are
 * devDependencies, and nothing under apps/*​/src or packages/*​/src imports them, so the deployed
 * Worker bundle never sees them.
 */
export interface TestWallet {
  /** 0x-prefixed 32-byte secret. Test material only. */
  privateKey: string;
  /** 0x-prefixed uncompressed public key, 64 bytes, without the 0x04 SEC1 prefix. */
  publicKey: string;
  /** 0x-prefixed 20-byte address, EIP-55 checksummed. */
  address: string;
}

const HEX_DIGITS = "0123456789abcdef";

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += HEX_DIGITS[byte >> 4] + HEX_DIGITS[byte & 15];
  return out;
}

export function fromHex(value: string): Uint8Array {
  const clean = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`not hexadecimal: ${value}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * EIP-55 mixed-case checksum.
 *
 * The case carries a checksum, so a typo in an address is caught before it reaches a venue. Venues
 * and explorers display this form, and a test comparing a lowercase address against a venue's
 * response would fail on case alone.
 */
export function toChecksumAddress(address: string): string {
  const lower = (address.startsWith("0x") ? address.slice(2) : address).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(lower)) throw new Error(`not an address: ${address}`);
  const hash = toHex(keccak_256(new TextEncoder().encode(lower)));
  let out = "0x";
  for (let i = 0; i < lower.length; i++) {
    out += Number.parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

/**
 * The address for an uncompressed public key: the last 20 bytes of keccak-256 over its 64 body
 * bytes. The 0x04 SEC1 prefix is dropped first — hashing it in shifts every byte and produces a
 * different, wrong address.
 */
export function addressFromPublicKey(uncompressed: Uint8Array): string {
  if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
    throw new Error(`expected a 65-byte uncompressed public key, got ${uncompressed.length} bytes`);
  }
  return toChecksumAddress(toHex(keccak_256(uncompressed.subarray(1)).subarray(12)));
}

/** The wallet a given secret key describes. Throws when the key is not a valid scalar. */
export function walletFromPrivateKey(privateKey: Uint8Array | string): TestWallet {
  const secret = typeof privateKey === "string" ? fromHex(privateKey) : privateKey;
  if (secret.length !== 32) throw new Error(`a private key is 32 bytes, got ${secret.length}`);
  // Zero and anything at or above the curve order are not usable scalars; the library decides, not us.
  if (!secp256k1.utils.isValidSecretKey(secret)) throw new Error("not a valid secp256k1 key");
  const uncompressed = secp256k1.getPublicKey(secret, false);
  return {
    privateKey: `0x${toHex(secret)}`,
    publicKey: `0x${toHex(uncompressed.subarray(1))}`,
    address: addressFromPublicKey(uncompressed),
  };
}

/**
 * A fresh wallet from the platform's cryptographic RNG.
 *
 * `randomSecretKey` draws from the same source as any other secure key generation and rejects the
 * out-of-range draws itself, so no key here is weaker than the curve allows. It is still test
 * material: see the warning above.
 */
export function generateTestWallet(): TestWallet {
  return walletFromPrivateKey(secp256k1.utils.randomSecretKey());
}
