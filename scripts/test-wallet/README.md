# Test wallets

Fresh EVM keypairs for testing the venue queries that need an account identity.

```
bun scripts/test-wallet/generate.ts        # one wallet
bun scripts/test-wallet/generate.ts 5      # five
```

**Never fund these.** They exist so a test can present an address to a public read endpoint. A key
that has been printed to a terminal is not safe for custody of anything.

## Why it exists

No adapter in this repo has ever needed a wallet: every venue is read over public endpoints. The
account-scoped queries do need one — Hyperliquid's `userFees` takes a master address
([`plans/member-fee-settings.md`](../../plans/member-fee-settings.md)) — and there was no address to
test with. The alternatives were worse: an address copied from a block explorer tests a stranger's
account, and a hand-typed hex string is not a point on the curve, so it fails differently than a real
one would.

## What a fresh address can and cannot test

It **can** test the plumbing: that the query is shaped correctly, that a response parses, that an
unknown account is handled. A brand-new address has no trading history, so a venue will report it at
base tier with no discounts.

It **cannot** test tier logic, referral or staking discounts, or the divergence display between
member-entered and venue-observed fees. Those need an account with real volume.

## Dependencies, and why

`@noble/curves` and `@noble/hashes`, as devDependencies. Both measured rather than assumed:

- Bun's `CryptoHasher` has no `keccak256` — only `sha3-*`.
- Bun's `node:crypto` rejects secp256k1 as `UNKNOWN_GROUP`.

Ethereum's keccak-256 is **not** SHA3-256; they differ in padding. Substituting `sha3-256` produces
well-formed addresses that are wrong, which no self-referential test would catch — so `wallet.test.ts`
checks against published vectors (EIP-55's own examples, and the addresses for scalars 1, 2 and 3)
rather than against this code's own output.

Nothing under `apps/*/src` or `packages/*/src` imports either library, so the deployed Worker bundle
never includes them.
