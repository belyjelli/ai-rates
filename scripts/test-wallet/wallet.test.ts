import { describe, expect, test } from "bun:test";
import {
  addressFromPublicKey,
  fromHex,
  generateTestWallet,
  toChecksumAddress,
  toHex,
  walletFromPrivateKey,
} from "./wallet";

/**
 * Every expectation here comes from OUTSIDE this code.
 *
 * A generator checked against its own output passes while producing addresses no venue would ever
 * recognise — which is exactly how substituting SHA3-256 for keccak-256 would slip through. So the
 * vectors are published ones: the EIP-55 specification's own examples, and the addresses the
 * best-known test private keys are famous for.
 */

/** Straight from EIP-55, "Test Cases". */
const EIP55 = [
  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
  "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
  "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
];

const key = (n: number): string => n.toString(16).padStart(64, "0");

describe("toChecksumAddress", () => {
  test("reproduces the EIP-55 specification's own examples", () => {
    for (const address of EIP55) {
      expect(toChecksumAddress(address.toLowerCase())).toBe(address);
      // Idempotent, and case in the input does not change the answer.
      expect(toChecksumAddress(address)).toBe(address);
    }
  });

  test("refuses anything that is not 20 bytes of hex", () => {
    expect(() => toChecksumAddress("0x1234")).toThrow();
    expect(() => toChecksumAddress(`0x${"z".repeat(40)}`)).toThrow();
  });
});

describe("walletFromPrivateKey", () => {
  test("derives the addresses these well-known test keys are published with", () => {
    // secp256k1 scalars 1, 2 and 3: the most widely reproduced key/address pairs there are.
    expect(walletFromPrivateKey(key(1)).address).toBe("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
    expect(walletFromPrivateKey(key(2)).address).toBe("0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF");
    expect(walletFromPrivateKey(key(3)).address).toBe("0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69");
  });

  test("accepts the same key as bytes or as a 0x string", () => {
    const asString = walletFromPrivateKey(`0x${key(1)}`);
    const asBytes = walletFromPrivateKey(fromHex(key(1)));
    expect(asBytes).toEqual(asString);
    expect(asString.privateKey).toBe(`0x${key(1)}`);
    // 64 bytes of public key, the 0x04 prefix already dropped.
    expect(asString.publicKey).toHaveLength(2 + 128);
  });

  test("rejects a key that is not a usable scalar, rather than inventing an address", () => {
    // Zero, and the curve order itself, are both outside the valid range.
    expect(() => walletFromPrivateKey(key(0))).toThrow();
    expect(() =>
      walletFromPrivateKey("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"),
    ).toThrow();
    expect(() => walletFromPrivateKey("0x01")).toThrow();
    expect(() => walletFromPrivateKey("not hex")).toThrow();
  });
});

describe("addressFromPublicKey", () => {
  test("refuses a compressed or malformed key instead of hashing the wrong bytes", () => {
    const uncompressed = fromHex(
      // The 0x04-prefixed public key for scalar 1.
      "0479BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",
    );
    expect(addressFromPublicKey(uncompressed)).toBe("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
    // Dropping the length check would hash 64 bytes with a shifted window and yield a wrong address.
    expect(() => addressFromPublicKey(uncompressed.subarray(1))).toThrow();
  });
});

describe("generateTestWallet", () => {
  test("every wallet is internally consistent and distinct from the last", () => {
    const first = generateTestWallet();
    const second = generateTestWallet();
    expect(first.address).not.toBe(second.address);
    // The address really is this key's address: re-derive it from the private key alone.
    expect(walletFromPrivateKey(first.privateKey)).toEqual(first);
    expect(first.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(toChecksumAddress(first.address)).toBe(first.address);
  });
});

describe("hex helpers", () => {
  test("round-trip, with and without the 0x prefix", () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xa5]);
    expect(toHex(bytes)).toBe("000fffa5");
    expect(fromHex("000fffa5")).toEqual(bytes);
    expect(fromHex("0x000fffa5")).toEqual(bytes);
    expect(() => fromHex("abc")).toThrow();
  });
});
