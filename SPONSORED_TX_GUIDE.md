# EIP-7702 Sponsored Transaction Guide

Based on: [QuickNode - EIP-7702 Transactions with Ethers.js](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)

## Overview

A **sponsored transaction** in EIP-7702 allows one wallet (the **Sponsor**) to pay for gas and send a transaction on behalf of another wallet (the **EOA/First Signer**) who provides only the authorization signature.

This is a powerful pattern for:
- **User Onboarding**: New users don't need ETH to perform their first transaction
- **Batch Operations**: Sponsor pays for multiple user actions in one transaction
- **Gas Sponsorship Services**: Third-party services can sponsor transactions for users
- **Payment Gateways**: Collect tokens without burdening the user with gas fees

## Key Difference from Non-Sponsored Transactions

| Aspect | Non-Sponsored | Sponsored |
|--------|---------------|-----------|
| **Sender** | EOA itself | Sponsor wallet |
| **Authorization** | Current nonce + 1 | Current nonce |
| **Gas Payment** | EOA pays | Sponsor pays |
| **Use Case** | User initiates own action | Service initiates for user |

## Script: `scripts/eip7702SponsoredTx.ts`

### Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your values
nano .env

# 3. Run the sponsored transaction
npx ts-node scripts/eip7702SponsoredTx.ts
```

### Required Environment Variables

```env
# Service Operator (Sponsor - who pays for gas)
PRIVATE_KEY=0x...

# Second Sponsor for Multi-Wallet Testing (optional for basic usage)
SPONSOR_PRIVATE_KEY=0x...

# Payment Gateway & Implementation
HOT_WALLET=0x...              # Token destination
TOKEN_TRANSFERER=0x...         # Implementation contract
USER_PAYMENT_ADDR=0x...        # EOA with tokens to collect
USER_PAYMENT_PRIVATE_KEY=0x... # (Used in other scripts, not here)
TEST_TOKEN=0x...               # Token contract address

# RPC Endpoint
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## How It Works: Step by Step

### Step 1: Initialize Signers
- Creates two wallets: EOA (signer) and Sponsor (sender)
- Connects to the blockchain
- Validates network configuration

```typescript
const { eoaSigner, sponsorSigner, provider, chainId } = await initializeSigners();
```

### Step 2: Create EIP-7702 Authorization

The authorization is a signature that gives permission to delegate code execution:

```
digest = keccak256(0x05 || rlp([chain_id, address, nonce]))
```

**Critical**: For sponsored transactions, use the **current nonce** (not `nonce + 1`).

Why? Because the sponsor sends the transaction (incrementing sponsor's nonce), while the EOA's authorization is validated against its current nonce.

```typescript
const currentNonce = await provider.getTransactionCount(eoaSigner.address);
// For sponsored: use currentNonce directly
const authorization = await createEIP7702Authorization({
  eoaSigner,
  provider,
  chainId,
  implementationAddress: TOKEN_TRANSFERER
});
```

### Step 3: Build Type 0x04 Transaction

The sponsor builds a Type 0x04 (EIP-7702 Set Code) transaction:

```typescript
const txData = {
  to: targetAddress,              // Where to send the call
  data: callData,                 // Function to invoke
  value: 0n,
  type: 4,                        // EIP-7702 type
  gasLimit: 200000n,
  gasPrice: feeData.gasPrice,
  nonce: sponsorNonce,            // Sponsor's nonce
  chainId: chainId,
  authorizationList: [
    {
      chainId,
      address: TOKEN_TRANSFERER,  // Implementation
      nonce: authorizationNonce,  // EOA's nonce (current)
      yParity: yParity,           // Signature parity
      r: signature.r,
      s: signature.s
    }
  ]
};
```

### Step 4: Send and Confirm

The sponsor sends the transaction:

```typescript
const tx = await sponsorSigner.sendTransaction(txData);
const receipt = await tx.wait();
```

## Example Output

```
╔════════════════════════════════════════════════════════════════════╗
║        EIP-7702 Sponsored Token Collection via ethers.js           ║
║        Reference: https://www.quicknode.com/guides/...            ║
╚════════════════════════════════════════════════════════════════════╝

Step 1: Initialize Signers
──────────────────────────────────────────────────────────────────────
Connected to chain: 421614 (arbitrumSepolia)
EOA (First Signer): 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
Sponsor: 0x1234567890123456789012345678901234567890
Implementation: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

Step 2: Create EIP-7702 Authorization
──────────────────────────────────────────────────────────────────────
EOA Current Nonce: 5
Using nonce: 5 (for sponsored transaction)
Digest created for authorization
  ChainId: 421614
  Implementation: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
  Nonce: 5
✓ Authorization signed by EOA

Step 3: Send Sponsored EIP-7702 Transaction
──────────────────────────────────────────────────────────────────────

Building Sponsored Transaction
──────────────────────────────────────────────────────────────────────
Gas Estimate: 95000
Gas Limit: 200000
Gas Price: 0.1 gwei
Est. Cost: 0.00002 ETH

Transaction Structure:
  Type: 0x04 (EIP-7702 Sponsored)
  Sender (Sponsor): 0x1234567890123456789012345678901234567890
  Target: 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
  Value: 0
  Gas Limit: 200000
  Gas Price: 0.1 gwei

Sending Transaction...
  ✓ Transaction submitted
  Hash: 0x...

Waiting for confirmation...
  ✓ Transaction confirmed
  Block Number: 1234567
  Gas Used: 95000
  Status: Success ✓

═══════════════════════════════════════════════════════════════════════
SPONSORED TRANSACTION COMPLETE ✓
═══════════════════════════════════════════════════════════════════════

Summary:
  Transaction Type: 0x04 (EIP-7702 Sponsored)
  EOA (Delegated): 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
  Sponsor: 0x1234567890123456789012345678901234567890
  Implementation: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
  Target: 0x5DfD0ec499A16F2a0f529f16fcE06bbaAb4ef8F8
  Gas Used: 95000
  Block: 1234567

Token Movement:
  Tokens Collected: 100 USDC
  Sponsor Cost: 0.0000095 ETH

Transaction Details:
  Hash: 0x...
  View: https://sepolia.arbiscan.io/tx/0x...

Key Insights:
  ✓ EOA did not pay for gas (Sponsor paid)
  ✓ EOA authorized delegation via authorization signature
  ✓ Sponsor sent transaction and paid all fees
  ✓ Tokens successfully collected from payment address
  ✓ EIP-7702 delegation remains active
```

## Common Issues & Solutions

### Issue: "RPC does not support Type 0x04"

**Solution**: Use an RPC endpoint that supports EIP-7702
- Arbitrum Sepolia: ✅ Supported
- Ethereum Sepolia: ❌ Not yet supported
- Use QuickNode with Arbitrum Sepolia endpoint

### Issue: "Invalid parity" error

**Solution**: Ensure `v` is converted to parity (0 or 1)
```typescript
const yParity = signature.v - 27;  // ✓ Correct
// NOT: yParity = signature.v;     // ✗ Wrong (gives 27 or 28)
```

### Issue: Authorization nonce mismatch

**Solution**: For sponsored transactions, use **current nonce**, not `nonce + 1`
```typescript
// ✓ Sponsored transactions
const nonce = await provider.getTransactionCount(eoaSigner.address);
// Use nonce directly (don't add 1)

// ✓ Non-sponsored transactions  
const nonce = await provider.getTransactionCount(eoaSigner.address) + 1;
// Add 1 because same wallet increments nonce before validation
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Sponsored Transaction Flow                │
└─────────────────────────────────────────────────────────┘

1. EOA (First Signer)
   ├─ Has tokens to collect
   ├─ Signs authorization
   └─ Does NOT send transaction

2. Authorization Creation
   ├─ Get EOA's current nonce
   ├─ Create digest: keccak256(0x05 || rlp([chainId, impl, nonce]))
   ├─ Sign digest with EOA's private key
   └─ Extract signature components (r, s, v)

3. Sponsor Wallet
   ├─ Gets EOA's nonce (from step 1)
   ├─ Creates Type 0x04 transaction
   ├─ Includes authorization list
   ├─ Signs transaction with sponsor's key
   └─ Sends transaction (pays all gas)

4. On-Chain Execution
   ├─ Sponsor's nonce incremented
   ├─ Authorization validated against EOA's nonce
   ├─ EOA's code slot set to delegation
   ├─ Target function executed in delegated context
   ├─ Delegation remains active (until revoked)
   └─ Tokens collected to hot wallet

5. Results
   ├─ Sponsor paid gas cost
   ├─ EOA paid nothing
   ├─ Tokens moved to hot wallet
   └─ Both nonces incremented
```

## Gas Costs

```
Typical sponsored transaction:
- Gas used: ~95,000 - 150,000
- Gas price (Arbitrum): 0.1 - 1 gwei
- Sponsor cost: ~0.0000095 - 0.00015 ETH (~0.03 - 0.5 USD)

This is significantly cheaper than:
- Traditional centralized collection: Transaction + API overhead
- Multiple individual withdrawals: N times the gas
- Smart contract wallets: Higher deployment + execution costs
```

## Use Cases

### 1. User Onboarding
```
New user has 100 USDC but no ETH
Sponsor collects tokens without user needing ETH
User can start using the platform immediately
```

### 2. Batch Collection
```
Sponsor collects from 10 users in sponsored transaction
Cost: ~0.001 ETH vs 0.01 ETH with separate transactions
10x cheaper collection process
```

### 3. Payment Gateway Integration
```
Gateway sponsors transactions for merchants
Merchants authorize without needing gas
Gateway absorbs minimal cost (<$0.01 per collection)
```

### 4. Cross-Chain Bridges
```
Sponsor facilitates token unlock on destination chain
User pays only on source chain
Seamless cross-chain experience
```

## Comparing Transaction Types

### Type 0x00 (Legacy)
- Simple transactions
- Fixed gas price
- No EIP-7702 support

### Type 0x02 (EIP-1559)
- Dynamic gas pricing
- Better fee estimation
- No EIP-7702 support

### Type 0x04 (EIP-7702 - Sponsored)
- ✅ Code delegation
- ✅ Temporary smart contract features
- ✅ Gas sponsorship possible
- ✅ No permanent address change
- ✅ Works across all EVMs with Pectra upgrade

## Testing Checklist

Before deploying to mainnet:

- [ ] Test with testnet funds (Arbitrum Sepolia)
- [ ] Verify balances before and after
- [ ] Check sponsor gas cost
- [ ] Verify EOA received no gas charges
- [ ] Confirm tokens moved to hot wallet
- [ ] Test with different token amounts
- [ ] Test with multiple EOAs
- [ ] Monitor authorization nonce
- [ ] Check delegation remains active
- [ ] Test with multiple consecutive transactions

## Performance Metrics

```
Single Sponsored Collection:
- Setup time: ~2 seconds
- Gas estimate: ~1-2 seconds
- Transaction send: <1 second
- Confirmation: ~10-15 seconds (Arbitrum Sepolia)
- Total: ~15-20 seconds per collection

Batch Sponsored Collection (N=10):
- Sequential: ~15-20 seconds × 10 = 150-200 seconds
- Parallel: ~15-20 seconds total
- Cost: ~0.001 ETH vs 0.01 ETH (10x cheaper)
```

## Security Considerations

1. **Nonce Mismanagement**: Always use correct nonce for transaction type
2. **Replay Attacks**: Include chainId in authorization (already done)
3. **Signature Verification**: Ensure signature matches digest exactly
4. **Authorization Persistence**: Delegation remains until explicitly revoked
5. **Gas Limits**: Always include safety margin (2x estimate)

## References

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [QuickNode EIP-7702 Guide](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/)

## Next Steps

1. **Test with real funds** on testnet
2. **Implement batch collection** for multiple users
3. **Add relay server** for external sponsorship
4. **Monitor gas costs** and optimize
5. **Deploy to mainnet** after thorough testing

---

**Ready to sponsor transactions?** Start with:
```bash
npx ts-node scripts/eip7702SponsoredTx.ts
```
