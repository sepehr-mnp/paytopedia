# Smart EIP-7702 Delegation Transfer

**Reference**: [QuickNode - How to Send EIP-7702 Transactions with Ethers.js](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)

## Overview

An intelligent script that **automatically detects delegation status** and adapts the EIP-7702 flow:

- ✅ **First Run**: No delegation → Create authorization & establish delegation
- ✅ **Subsequent Runs**: Delegation exists → Reuse it, just call transfer()
- ✅ **Wrong Implementation**: Different delegation → Update to correct one
- ✅ **Sponsored**: Sponsor always pays gas in all scenarios

## Quick Start

```bash
# 1. Setup
cp .env.example .env
nano .env

# 2. Run (first time - creates delegation)
npx ts-node scripts/smartEIP7702Transfer.ts

# 3. Run again (reuses delegation)
npx ts-node scripts/smartEIP7702Transfer.ts

# Both succeed, different paths!
```

## How It Works

### Decision Tree

```
┌─────────────────────────────────────────────────────────┐
│              Smart Delegation Flow                      │
└─────────────────────────────────────────────────────────┘

START
  │
  ├─► Check EOA Code
  │
  ├─► hasCode == false (NO delegation)
  │   │
  │   ├─ Create authorization digest
  │   ├─ Sign with EOA's private key
  │   ├─ Build Type 0x04 with authorization list
  │   ├─ Sponsor sends transaction
  │   ├─ EVM sets delegation
  │   └─ transfer() executes
  │   └─► NEXT RUN: Uses delegation directly
  │
  └─► hasCode == true (HAS delegation)
      │
      ├─ Parse delegation address
      │
      ├─► isCorrect == true
      │   │
      │   ├─ Skip authorization
      │   ├─ Build Type 0x04 WITHOUT authorization list
      │   ├─ Sponsor sends transaction
      │   ├─ Delegation already active
      │   └─ transfer() executes faster
      │
      └─► isCorrect == false
          │
          ├─ Create new authorization
          ├─ Sign with EOA's private key
          ├─ Build Type 0x04 with authorization list
          ├─ Sponsor sends transaction
          ├─ EVM UPDATES delegation
          └─ transfer() executes
```

## Code at Each Stage

### Stage 1: Check Delegation

```typescript
// Get code at EOA address
const code = await provider.getCode(eoa.address);

if (code === '0x') {
  // No delegation, needs setup
  return { hasCode: false, codeAddress: null };
}

// Code exists, parse it
// EIP-7702 format: 0xef0100 + address (20 bytes)
if (code.length === 48 && code.startsWith('0xef0100')) {
  const delegatedAddr = '0x' + code.slice(8);
  const isCorrect = delegatedAddr.toLowerCase() === 
                   TOKEN_TRANSFERER.toLowerCase();
  return { 
    hasCode: true, 
    codeAddress: delegatedAddr, 
    isCorrectImpl: isCorrect 
  };
}
```

### Stage 2: Create Authorization (if needed)

```typescript
// Only if no delegation or needs update
const digest = ethers.keccak256(
  ethers.concat(['0x05', authTupleData])
);

const signature = eoa.signingKey.sign(digest);
const yParity = signature.v - 27;

return {
  chainId,
  address: TOKEN_TRANSFERER,
  nonce: eoaNonce,  // CURRENT nonce (not +1)
  yParity,
  r: signature.r,
  s: signature.s
};
```

### Stage 3: Build Transaction

```typescript
// Build base transaction
let txData = {
  to: eoa.address,
  data: callData,
  type: 4,
  nonce: sponsorNonce,
  chainId,
  gasLimit,
  gasPrice
};

// Add authorization only if needed
if (!hasDelegation && authorization) {
  txData.authorizationList = [
    {
      chainId: authorization.chainId,
      address: authorization.address,
      nonce: authorization.nonce,
      yParity: authorization.yParity,
      r: authorization.r,
      s: authorization.s
    }
  ];
} else if (hasDelegation) {
  txData.authorizationList = [];  // Empty = use existing
}

// Send from sponsor
const tx = await sponsor.sendTransaction(txData);
```

## Flow Comparison

### First Run (No Delegation)

```
FIRST RUN - Establish Delegation
──────────────────────────────────

Step 2: Check Delegation
  ✓ EOA has NO code delegation
    Address: 0x5DfD...
    Code: None

Step 3: Create Authorization
  ✓ Authorization digest created
  ✓ Signed with EOA private key
    Signature V (parity): 0

Step 4: Send Transaction
  📍 Transaction includes NEW EIP-7702 authorization
  ✓ Transaction submitted
  ✓ Transaction confirmed
  ✓ Block: 1234567

NEW delegation established!
NEXT RUN will reuse it automatically.
```

### Second Run (Reuse Delegation)

```
SECOND RUN - Reuse Existing Delegation
──────────────────────────────────────

Step 2: Check Delegation
  ✓ EOA has code delegation!
    Delegated to: 0xabcdefabcdefabcdefabcdef...
    Correct implementation: ✓

Step 3: Authorization
  ✓ EOA already delegated to correct implementation
    No new authorization needed
  (SKIPPED - delegation already active)

Step 4: Send Transaction
  📍 Transaction uses EXISTING delegation
  ✓ Transaction submitted
  ✓ Transaction confirmed
  ✓ Block: 1234568

REUSED delegation!
Faster & cheaper than first run.
```

## Key Technical Details

### Delegation Detection

```typescript
// EIP-7702 delegation format
0xef0100 + <20-byte-address>

Example:
  0xef0100 + abcdef...abcdef
  = 0xef0100abcdef...abcdef (48 chars total)

Code field check:
  - 0x = no delegation
  - 0xef0100... = EIP-7702 delegation
  - anything else = unknown code
```

### When Authorization is Needed

| Scenario | Has Code? | Code Correct? | Authorization? |
|----------|-----------|---------------|----------------|
| First run | ✗ No | - | ✓ YES |
| Reuse | ✓ Yes | ✓ Yes | ✗ NO |
| Update | ✓ Yes | ✗ No | ✓ YES |

### Gas Savings on Reuse

```
First Run (with authorization):
├─ Authorization: ~50-100 gas
├─ Transaction: ~95,000 gas
└─ Total: ~95,050-95,100 gas

Second Run (no authorization):
├─ Transaction only: ~95,000 gas
└─ Savings: ~50-100 gas

Per run savings: ~0.5-1 gwei worth
```

## Environment Variables

```env
PRIVATE_KEY=0x...                  # Sponsor (pays gas)
USER_PAYMENT_PRIVATE_KEY=0x...     # EOA (signs auth if needed)
TOKEN_TRANSFERER=0x...              # Implementation
USER_PAYMENT_ADDR=0x...             # Payment address
HOT_WALLET=0x...                    # Token destination
TEST_TOKEN=0x...                    # Token contract
RCP_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## Usage Scenarios

### Scenario 1: Batch Token Collection

```
Day 1:
└─ First user
   ├─ Check: No delegation
   ├─ Create authorization
   ├─ Establish delegation
   ├─ Collect tokens
   └─ Sponsor cost: ~$0.03

Day 2:
└─ Same user again
   ├─ Check: Has delegation ✓
   ├─ Skip authorization
   ├─ Reuse delegation
   ├─ Collect tokens
   └─ Sponsor cost: ~$0.029 (saves ~0.5 gwei)

Day 3-30:
└─ Same user
   ├─ Check: Has delegation ✓
   ├─ Skip authorization
   ├─ Reuse delegation
   ├─ Collect tokens
   └─ Sponsor cost: ~$0.029 (per collection)

TOTAL SAVINGS: $0.01+ per user over 30 days
```

### Scenario 2: Multi-Implementation Support

```
User A:
├─ Run 1: No delegation
│   ├─ Create auth for Impl-A
│   └─ Establish delegation to Impl-A
└─ Run 2: Has delegation to Impl-A
    ├─ Check: Correct implementation ✓
    └─ Reuse

User B (needs different impl):
├─ Run 1: No delegation
│   ├─ Create auth for Impl-B
│   └─ Establish delegation to Impl-B
└─ Run 2: Has delegation to Impl-B
    ├─ Check: Correct implementation ✓
    └─ Reuse

Dynamic handling of multiple implementations!
```

### Scenario 3: Implementation Update

```
Old Flow:
├─ EOA delegated to OldImpl
├─ Sponsor tried to use OldImpl
└─ Problem: Wrong implementation

New Flow (smart):
├─ EOA delegated to OldImpl
├─ Check: Code exists ✓
├─ Check: Is OldImpl? ✗ (expected NewImpl)
├─ Create auth for NewImpl
├─ Update delegation to NewImpl
└─ Continue normally

Seamless implementation switching!
```

## Example Output

### First Run

```
📋 Step 1: Initialize & Validate
✓ Connected to chain: 421614 (arbitrumSepolia)
✓ EOA Address: 0x5DfD...

🔍 Step 2: Check EOA Delegation Status
✓ EOA has NO code delegation
  Address: 0x5DfD...
  Code: None

🔐 Step 3: Create EIP-7702 Authorization (using eoa.authorize)
EOA Current Nonce: 5
Digest created for authorization
✓ Authorization signed by EOA
  Signature V (parity): 0

📝 Step 4: Send Transfer Transaction
📋 Building Transaction
  Gas Estimate: 95000
  Gas Limit (2x): 190000

📍 Transaction includes NEW EIP-7702 authorization
✉️ Sending Transaction...
✓ Transaction submitted
Hash: 0xabcdef...

⏳ Waiting for confirmation...
✓ Transaction confirmed
Block Number: 1234567
Gas Used: 95000

═══════════════════════════════════════════════════════════════════════════
✅ SMART EIP-7702 TRANSFER COMPLETE
═══════════════════════════════════════════════════════════════════════════

🎯 What Happened:
1. EOA had NO code delegation
2. Created EIP-7702 authorization digest
3. Signed with EOA's private key
4. Sponsor sent Type 0x04 transaction
5. EVM established delegation
6. transfer() executed in delegated context
7. Tokens moved to hot wallet
```

### Second Run

```
🔍 Step 2: Check EOA Delegation Status
✓ EOA has code delegation!
  Address: 0x5DfD...
  Code: 0xef0100abcdef...
  Delegated to: 0xabcdef...
  Correct implementation: ✓

✓ EOA already delegated to correct implementation
  No new authorization needed

📝 Step 4: Send Transfer Transaction
📍 Transaction uses EXISTING delegation (no authorization needed)
✉️ Sending Transaction...
✓ Transaction submitted
✓ Transaction confirmed

🎯 What Happened:
1. EOA already had delegation
2. Sponsor sent Type 0x04 transaction
3. Reused existing delegation
4. transfer() executed in delegated context
5. Tokens moved to hot wallet
```

## Key Advantages

✅ **Automatic Detection**: No manual code checks needed
✅ **First-Time Setup**: Automatically creates authorization
✅ **Reuse Optimization**: Skips unnecessary steps on subsequent runs
✅ **Flexible**: Handles different implementations
✅ **Sponsored**: Sponsor always pays, always works
✅ **Cost Efficient**: Saves gas on reuse
✅ **Error Handling**: Clear guidance if delegation is wrong

## Commands

```bash
# Run the smart delegation transfer
npx ts-node scripts/smartEIP7702Transfer.ts

# Run multiple times to see reuse
for i in {1..3}; do
  npx ts-node scripts/smartEIP7702Transfer.ts
  echo "---"
done
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "No code delegation" on 2nd run | RPC cache | Wait a block or use different RPC |
| "Wrong implementation" warning | Delegation to old impl | Script auto-updates to correct one |
| Authorization fails | Signature mismatch | Check PRIVATE_KEY and USER_PAYMENT_PRIVATE_KEY |
| Type 0x04 not supported | Wrong RPC | Use Arbitrum Sepolia RPC |

## References

- [QuickNode EIP-7702 Guide](https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

---

**Ready to use smart delegation?**

```bash
npx ts-node scripts/smartEIP7702Transfer.ts
```

This script handles everything automatically! 🚀
