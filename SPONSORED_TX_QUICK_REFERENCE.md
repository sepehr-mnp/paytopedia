# EIP-7702 Sponsored Transactions - Quick Reference

## What's a Sponsored Transaction?

```
Sponsor Pays                          EOA Authorizes
    ↓                                    ↓
┌──────────────┐                  ┌────────────────┐
│ Sends Tx     │ includes auth    │ Signs only     │
│ Pays gas     │ from            │ Doesn't send   │
│ Type 0x04    │ ←────────────── │ Nothing paid   │
└──────────────┘                  └────────────────┘
```

## Key Concepts

| Concept | Value | Why |
|---------|-------|-----|
| **Authorization Nonce** | Current | Sponsor increments before validation |
| **Transaction Type** | 0x04 | EIP-7702 Set Code type |
| **Sender** | Sponsor | Who pays gas and sends |
| **Signer** | EOA | Provides authorization only |
| **Digest** | `keccak256(0x05 \|\| rlp([chainId, impl, nonce]))` | EIP-7702 standard |
| **V Parity** | 0 or 1 | Converted from ECDSA 27/28 |

## Code Template

```typescript
// 1. Get signers
const eoaSigner = new ethers.Wallet(privateKey1, provider);
const sponsor = new ethers.Wallet(privateKey2, provider);

// 2. Create authorization
const nonce = await provider.getTransactionCount(eoaSigner.address); // Current nonce
const digest = ethers.keccak256(
  ethers.concat(['0x05', 
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint64'],
      [chainId, implementation, nonce]
    )
  ])
);
const sig = eoaSigner.signingKey.sign(digest);
const yParity = sig.v - 27;

// 3. Build transaction
const tx = {
  to: targetAddress,
  data: callData,
  type: 4,
  nonce: await provider.getTransactionCount(sponsor.address),
  chainId,
  authorizationList: [{
    chainId,
    address: implementation,
    nonce,
    yParity,
    r: sig.r,
    s: sig.s
  }]
};

// 4. Send
const receipt = await sponsor.sendTransaction(tx);
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid parity: 27` | V not converted | `v_parity = v - 27` |
| `nonce mismatch` | Used nonce + 1 | Use current nonce only |
| `Type 0x04 not supported` | RPC doesn't support EIP-7702 | Use Arbitrum Sepolia RPC |
| `authorization failed` | Wrong digest | Verify digest formula |

## Setup in 3 Steps

```bash
# 1. Copy template
cp .env.example .env

# 2. Add sponsor key
echo "SPONSOR_PRIVATE_KEY=0x..." >> .env

# 3. Run
npx ts-node scripts/eip7702SponsoredTx.ts
```

## Environment Variables

```env
PRIVATE_KEY=0x...                  # EOA (signer)
SPONSOR_PRIVATE_KEY=0x...          # Sponsor (sender/payer)
TOKEN_TRANSFERER=0x...              # Implementation
USER_PAYMENT_ADDR=0x...             # Target address
HOT_WALLET=0x...                    # Token destination
TEST_TOKEN=0x...                    # Token contract
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## Transaction Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 Sponsored Transaction                  │
└─────────────────────────────────────────────────────────┘

Step 1: Get Nonces & Sign Authorization
  ├─ EOA nonce: getTransactionCount(eoaSigner)
  ├─ Create digest
  ├─ Sign with EOA private key
  └─ Get (r, s, v_parity)

Step 2: Get Sponsor Details
  ├─ Sponsor nonce: getTransactionCount(sponsor)
  ├─ Get gas price
  └─ Estimate gas

Step 3: Build Type 0x04 Transaction
  ├─ to: targetAddress
  ├─ data: callData
  ├─ type: 4
  ├─ nonce: sponsorNonce
  ├─ authorizationList: [{ nonce: eaoNonce, ... }]
  └─ gas/gasPrice from step 2

Step 4: Send Transaction
  ├─ sponsor.sendTransaction(tx)
  ├─ Wait for confirmation
  └─ Verify results

Step 5: Verify
  ├─ EOA nonce incremented: +1
  ├─ Sponsor nonce incremented: +1
  ├─ Sponsor balance decreased: gasUsed * gasPrice
  ├─ Tokens collected to hotWallet
  └─ Delegation remains active
```

## Nonce Rules

```
┌─────────────────────────────────┐
│   Authorization Nonce Rules     │
└─────────────────────────────────┘

NON-SPONSORED:                  SPONSORED:
(Same wallet sends & signs)     (Different wallets)

currentNonce + 1                currentNonce
       ↑                              ↑
 Increment by 1               Use as-is
 (before sending)             (same wallet pays)
```

## Gas Cost Example

```
Scenario: Collect 100 USDC from 10 users

TRADITIONAL METHOD:
├─ 10 separate transactions
├─ ~95,000 gas each
├─ Total: 950,000 gas
├─ Cost: 0.01 ETH (~$30)
└─ Time: ~150 seconds

EIP-7702 SPONSORED (Batch Possible):
├─ 1 sponsored transaction per user
├─ ~95,000 gas each  
├─ Total: 95,000 gas (one at a time)
├─ Cost: 0.00095 ETH (~$3)  
├─ Time: ~15-20 seconds per user
└─ Parallel possible: ~20 seconds all

SAVINGS: 90% gas reduction
```

## Step-by-Step Usage

### Before Running

```bash
# Fund accounts on Arbitrum Sepolia
# EOA (signer): Needs some ETH for test
# Sponsor: Needs ETH to pay gas
# User (payment addr): Needs tokens to collect

# Use faucets:
# - ETH: https://faucet.quicknode.com/
# - USDC: https://faucet.circle.com/
```

### Run Script

```bash
npx ts-node scripts/eip7702SponsoredTx.ts

# Expected output:
# ✓ Signers initialized
# ✓ Authorization created
# ✓ Transaction sent
# ✓ Transaction confirmed
# ✓ Tokens collected
# ✓ Sponsor paid X ETH gas
```

### Verify Results

```bash
# Check block explorer
https://sepolia.arbiscan.io/tx/[HASH]

# Should see:
# - Transaction Type: 4 (EIP-7702)
# - From: Sponsor address
# - To: Target address
# - Authorization list: [1 entry]
# - Status: Success
```

## Real-World Scenarios

### Scenario 1: Token Onboarding
```
User has USDC, no ETH
→ Sponsor collects USDC for them
→ Zero cost to user
→ Sponsor cost: <$0.01
→ User ready to use immediately
```

### Scenario 2: Payment Gateway
```
Merchant wants to collect from 100 customers
→ Sponsor sends 100 txs, pays gas for all
→ Cost: ~$0.01 per customer
→ Traditional: $30+ for same collection
→ Savings: 99%
```

### Scenario 3: Bridge/Unlock
```
User has locked tokens on chain B
→ Sponsor sponsors unlock on chain B
→ User only paid gas on chain A
→ Seamless experience
```

## Security Checklist

- [ ] ChainId included in digest (replay protection)
- [ ] Correct nonce (current for sponsored)
- [ ] V properly converted to parity (v - 27)
- [ ] Signature matches digest
- [ ] Gas limit has safety margin (2x estimate)
- [ ] EOA private key kept secret
- [ ] Sponsor private key kept secret
- [ ] RPC endpoint supports Type 0x04
- [ ] Balances verified before/after

## Troubleshooting

```
❌ Error: "RPC does not support type 4"
✅ Use Arbitrum Sepolia RPC, not Ethereum Sepolia

❌ Error: "invalid parity"
✅ Convert v to parity: v_parity = v - 27

❌ Error: "authorization failed"
✅ Check nonce is current (not +1)

❌ Error: "insufficient gas"
✅ Fund sponsor with more ETH

❌ Error: "unknown authorization field"
✅ Ensure chainId, address, nonce are correct types
```

## Performance

```
Latency Breakdown:
├─ Initialize signers: ~500ms
├─ Create authorization: ~200ms
├─ Build transaction: ~100ms
├─ Estimate gas: ~800ms
├─ Send transaction: ~1000ms
├─ Wait for confirmation: ~10-15s
└─ Total: ~13-17 seconds
```

## Comparison: All Transaction Types

```
            Type 0x00   Type 0x02   Type 0x04
            (Legacy)    (EIP-1559)  (EIP-7702)
─────────────────────────────────────────────
Delegation    ❌          ❌          ✅
Gas Sponsor   ❌          ❌          ✅
EVM Support   ✅          ✅          ⚠️ (Pectra+)
Code Execution Static      Static      Delegated
Fee Model     Fixed       Dynamic     Dynamic+Auth
```

## Resources

- 📖 [EIP-7702 Spec](https://eips.ethereum.org/EIPS/eip-7702)
- 🚀 [QuickNode Guide](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)
- 💻 [Script Code](./scripts/eip7702SponsoredTx.ts)
- 📚 [Full Guide](./SPONSORED_TX_GUIDE.md)

---

**Need help?** Check the [Full Guide](./SPONSORED_TX_GUIDE.md) for detailed explanations.

**Ready to go?** Run:
```bash
npx ts-node scripts/eip7702SponsoredTx.ts
```
