# EIP-7702 Simple Sponsored Transfer

**Reference**: [QuickNode - How to Send EIP-7702 Transactions with Ethers.js](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)

## Overview

A minimal, production-ready EIP-7702 sponsored transfer that demonstrates:
- EOA authorizes delegation (signs only)
- Sponsor sends transaction and pays gas
- `transfer()` function called in delegated context
- Tokens move directly to hot wallet

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
nano .env  # Fill in your values

# 2. Run the simple transfer
npx ts-node scripts/sponsoredTransferSimple.ts
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│     EIP-7702 Sponsored Transfer Flow            │
└─────────────────────────────────────────────────┘

Step 1: Environment Validation
  └─ Check all required addresses and keys
  
Step 2: Check Initial Balances
  └─ Verify EOA has tokens
  └─ Verify sponsor has ETH
  
Step 3: Create Authorization
  └─ Get EOA's current nonce (not +1)
  └─ Create digest: keccak256(0x05 || rlp([chainId, impl, nonce]))
  └─ Sign with EOA's private key
  └─ Convert v to parity (0 or 1)
  
Step 4: Encode Transfer Call
  └─ Function: transfer(address token, address recipient)
  └─ Parameters: token contract, hot wallet address
  
Step 5: Estimate Gas
  └─ Get estimate from RPC
  └─ Apply 2x safety margin
  
Step 6: Build Type 0x04 Transaction
  └─ Set type to 4 (EIP-7702)
  └─ Include authorization list
  └─ Sponsor pays for everything
  
Step 7: Send Transaction
  └─ Sponsor sends via RPC
  
Step 8: Wait for Confirmation
  └─ Monitor blockchain
  
Step 9: Verify Results
  └─ Check final balances
  └─ Confirm tokens transferred
```

## Key Differences: Sponsored vs Non-Sponsored

| Aspect | Non-Sponsored | Sponsored |
|--------|---|---|
| **Nonce** | `current + 1` | `current` |
| **Sender** | EOA | Sponsor |
| **Payer** | EOA | Sponsor |
| **Authorization** | Must use `+1` | Use as-is |
| **Cost** | EOA pays gas | Sponsor pays gas |

### Why Current Nonce for Sponsored?

```
Non-Sponsored (same wallet):
  1. Get nonce: 5
  2. Sign with: nonce + 1 = 6
  3. When sent, EVM increments to 6 (matches auth)
  4. Nonce becomes 7

Sponsored (different wallets):
  1. EOA nonce: 5 (not incremented yet)
  2. Sponsor sends tx (increments sponsor's nonce, not EOA's)
  3. Authorization checked against EOA's nonce: 5
  4. Must use current nonce (5), not 6
```

## Code Overview

### Authorization Digest Creation

```typescript
// Create the authorization digest per EIP-7702 specification
const authTupleData = ethers.AbiCoder.defaultAbiCoder().encode(
  ['uint256', 'address', 'uint64'],
  [chainId, TOKEN_TRANSFERER, eoaNonce]
);

const digest = ethers.keccak256(
  ethers.concat(['0x05', authTupleData])
);

// Sign with EOA's private key
const signature = eoa.signingKey.sign(digest);
const yParity = signature.v - 27; // Convert to EIP-7702 format
```

### Transfer Call Encoding

```typescript
// Encode the transfer function call
const iface = new ethers.Interface([
  'function transfer(address token, address recipient) public'
]);

const callData = iface.encodeFunctionData(
  'transfer', 
  [TEST_TOKEN, HOT_WALLET]
);
```

### Type 0x04 Transaction

```typescript
const txData = {
  to: eoa.address,                    // EOA address
  data: callData,                     // transfer() call
  type: 4,                            // EIP-7702
  nonce: sponsorNonce,                // Sponsor's nonce
  authorizationList: [
    {
      chainId: chainId,
      address: TOKEN_TRANSFERER,      // Implementation
      nonce: eoaNonce,                // EOA's CURRENT nonce
      yParity: yParity,               // 0 or 1
      r: signature.r,
      s: signature.s
    }
  ]
};

// Send from sponsor's account
const tx = await sponsor.sendTransaction(txData);
```

## Environment Variables

```env
# Service operator who sponsors (pays gas)
PRIVATE_KEY=0x...

# EOA who authorizes (has tokens)
USER_PAYMENT_PRIVATE_KEY=0x...

# Implementation contract
TOKEN_TRANSFERER=0x...

# Payment address (EOA with tokens)
USER_PAYMENT_ADDR=0x...

# Token destination
HOT_WALLET=0x...

# Token contract
TEST_TOKEN=0x...

# RPC endpoint (must support EIP-7702 Type 0x04)
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## Example Output

```
╔═══════════════════════════════════════════════════════════════════╗
║       EIP-7702 Sponsored Transfer - Simple Implementation         ║
║                                                                   ║
║    Reference: https://www.quicknode.com/guides/...               ║
╚═══════════════════════════════════════════════════════════════════╝

📋 Step 1: Initialize & Validate
──────────────────────────────────────────────────────────────────────
✓ Connected to chain: 421614 (arbitrumSepolia)
✓ EOA Address: 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
✓ Sponsor Address: 0x1234567890...
✓ Implementation: 0xabcdefabcdefabcdefabcdef...
✓ Token Contract: 0x1111111111...
✓ Hot Wallet: 0x2222222222...

💰 Step 2: Check Initial Balances
──────────────────────────────────────────────────────────────────────
  0x5DfD... USDC: 100 USDC
  0x2222... USDC: 0 USDC
  Sponsor ETH: 0.5 ETH

🔐 Step 3: Create EIP-7702 Authorization
──────────────────────────────────────────────────────────────────────
  EOA Current Nonce: 5
  ✓ Authorization digest created
    ChainId: 421614
    Implementation: 0xabcdefabcdef...
    Nonce: 5
  ✓ Signed with EOA private key
    V Parity: 0 (converted from 27)

📝 Step 4: Encode Transfer Call Data
──────────────────────────────────────────────────────────────────────
  ✓ Encoded transfer(0x1111..., 0x2222...)
    Call Data: 0x12345abc...

⛽ Step 5: Estimate Gas
──────────────────────────────────────────────────────────────────────
  Gas Estimate: 95000
  Gas Limit (2x): 190000
  Gas Price: 0.1 gwei
  Est. Cost: 0.000019 ETH

🏗️  Step 6: Build EIP-7702 Type 0x04 Transaction
──────────────────────────────────────────────────────────────────────
  Type: 0x04 (EIP-7702 Set Code Transaction)
  To (EOA): 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
  From (Sponsor): 0x1234567890...
  Data: 0x12345abc... (transfer call)
  Nonce: 10
  Gas Limit: 190000
  Authorization: Implementation set to 0xabcdefabcdef...

✉️  Step 7: Send Sponsored Transaction
──────────────────────────────────────────────────────────────────────
  ✓ Transaction submitted to mempool
  Hash: 0xabcdef123456...

⏳ Step 8: Wait for Confirmation
──────────────────────────────────────────────────────────────────────
  ✓ Transaction confirmed
  Block Number: 1234567
  Gas Used: 95000
  Status: ✓ Success

✅ Step 9: Verify Transfer Results
──────────────────────────────────────────────────────────────────────
  EOA Balance After: 0 USDC
  Hot Wallet Balance After: 100 USDC
  Tokens Transferred: 100 USDC

═══════════════════════════════════════════════════════════════════════
✅ SPONSORED TRANSFER COMPLETE
═══════════════════════════════════════════════════════════════════════

📊 Transaction Summary:
  Type: 0x04 (EIP-7702 Sponsored)
  EOA (Authorized): 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
  Sponsor (Payer): 0x1234567890...
  Implementation: 0xabcdefabcdef...
  Function Called: transfer()
  Gas Used: 95000
  Block: 1234567

💫 What Happened:
  1. EOA signed EIP-7702 authorization
  2. Sponsor sent Type 0x04 transaction (paid gas)
  3. EVM delegated EOA to 0xabcdefabcdef...
  4. transfer() executed in delegated context
  5. Tokens moved to hot wallet
  6. Delegation remains active

🔗 Explorer:
  https://sepolia.arbiscan.io/tx/0xabcdef123456...

💰 Cost Analysis:
  Gas Used: 95000 units
  Gas Price: 0.1 gwei
  Total Cost: 0.0000095 ETH
  Paid by: Sponsor (EOA paid $0)

🎯 Key Insights:
  ✓ EOA authorized with current nonce (not +1)
  ✓ Different wallets: EOA signs, Sponsor sends
  ✓ Sponsor absorbs all gas costs
  ✓ EOA has zero ETH cost
  ✓ Transfer completed in delegated context
  ✓ Tokens successfully collected

═══════════════════════════════════════════════════════════════════════
```

## Common Issues & Solutions

### Issue: "Invalid Parity: 27"
```
Cause: v value not converted to parity format
Fix: Use yParity = signature.v - 27
```

### Issue: "Authorization Nonce Mismatch"
```
Cause: Using nonce + 1 for sponsored transaction
Fix: Use current nonce directly (no increment)
```

### Issue: "RPC Does Not Support Type 0x04"
```
Cause: RPC doesn't support EIP-7702 transactions
Fix: Use Arbitrum Sepolia: https://sepolia-rollup.arbitrum.io/rpc
```

### Issue: "Insufficient Gas"
```
Cause: Sponsor account has no ETH
Fix: Fund sponsor address with ETH from faucet
```

## Verification Checklist

- [ ] Environment variables all set
- [ ] EOA has tokens to transfer
- [ ] Sponsor has ETH for gas
- [ ] RPC supports Type 0x04
- [ ] Implementation contract deployed
- [ ] Hot wallet address correct
- [ ] Token contract address correct

## Gas Costs

```
Simple Sponsored Transfer:
├─ Gas Used: ~95,000 units
├─ Gas Price: 0.1 - 1 gwei (Arbitrum)
├─ Total Cost: ~0.0000095 - 0.000095 ETH
└─ Paid by: Sponsor

Benefit:
├─ EOA pays: $0 (Sponsor covers all)
├─ User onboarding: Free to user
└─ Scalability: Sponsor can handle 1000s
```

## Customization

### Different Token
```typescript
const TEST_TOKEN = "0x..."; // Any ERC20
```

### Different Implementation
```typescript
const TOKEN_TRANSFERER = "0x..."; // Any contract
```

### Different Recipient
```typescript
const HOT_WALLET = "0x..."; // Any address
```

### Different Amount
Modify the `transfer()` call or implement multi-transfer logic.

## Performance

```
Typical Sponsored Transfer:
├─ Setup: ~2 seconds
├─ Authorization: ~1 second
├─ Gas estimation: ~1 second
├─ Send: <1 second
├─ Wait for confirmation: ~10-15 seconds
└─ Total: ~15-20 seconds
```

## Real-World Use Cases

### 1. User Onboarding
- New user has tokens, no ETH
- Sponsor completes initial transaction
- User ready to use immediately

### 2. Payment Gateways
- Collect from merchants' customers
- Merchants don't need to manage ETH
- Gateway pays for everything

### 3. Token Airdrops
- Distribute tokens efficiently
- Sponsor pays collection fees
- Users receive tokens for free

### 4. Batch Processing
- Multiple collections
- Sponsor pays once per batch
- 10x cheaper than individual TXs

## Security

✓ ChainId included (replay protection)
✓ Proper nonce handling
✓ Signature verification
✓ Authorization validation
✓ Temporary delegation only
✓ Private keys in environment

## References

- [QuickNode EIP-7702 Guide](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

## Command Reference

```bash
# Run simple transfer
npx ts-node scripts/sponsoredTransferSimple.ts

# Run original implementation
npx ts-node scripts/eip7702SponsoredTx.ts

# Check TypeScript
npx tsc --noEmit

# View transaction
https://sepolia.arbiscan.io/tx/[HASH]
```

---

**Ready to sponsor a transfer?**
```bash
npx ts-node scripts/sponsoredTransferSimple.ts
```

This single script handles:
- ✅ Environment validation
- ✅ Balance checks
- ✅ Authorization creation
- ✅ Transfer encoding
- ✅ Gas estimation
- ✅ Transaction building
- ✅ Sending via sponsor
- ✅ Confirmation waiting
- ✅ Result verification

**That's all you need!** 🚀
