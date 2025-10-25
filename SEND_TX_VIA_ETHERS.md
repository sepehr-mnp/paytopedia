# Send EIP-7702 Transaction via ethers.js

## Overview

The `scripts/sendTransactionViaEthers.ts` script sends an actual EIP-7702 set code transaction (Type 0x04) to the blockchain using ethers.js v6.

## Quick Start

```bash
npx ts-node scripts/sendTransactionViaEthers.ts
```

## What This Script Does

The script performs these steps:

### 1. **Configuration & Validation**
- Loads all environment variables from `.env`
- Validates RPC connectivity
- Checks wallet balances

### 2. **Create EIP-7702 Authorization**
- Generates authorization digest: `keccak256(0x05 || rlp([chainId, address, nonce]))`
- Signs digest with payment address private key
- Converts signature to EIP-7702 format (y-parity: 0 or 1)

### 3. **Prepare Transaction Data**
- Encodes TokenTransferer.transfer() call
- Specifies payment address as destination
- Sets value to 0

### 4. **Estimate Gas**
- Gets gas estimate for the call
- Retrieves current gas price
- Multiplies gas estimate by 2x for safety margin

### 5. **Build Type 0x04 Transaction**
- Creates transaction with Type: 0x04 (Set Code Transaction)
- Includes authorization list with delegation signature
- Sets proper gas limit and price

### 6. **Send Transaction via ethers.js**
```typescript
const tx = await serviceOperator.sendTransaction(txData);
```

### 7. **Wait for Confirmation**
- Monitors transaction on-chain
- Waits for block confirmation
- Retrieves receipt with gas used

### 8. **Verify Results**
- Checks final balances
- Confirms token transfer succeeded
- Displays Arbiscan link

## Transaction Structure

```typescript
{
  type: 4,  // EIP-7702 Set Code Transaction
  to: USER_PAYMENT_ADDR,
  data: encodedTransferCall,
  value: 0,
  gasLimit: estimatedGas * 2,
  gasPrice: currentGasPrice,
  chainId: 421614,  // Arbitrum Sepolia
  authorizationList: [
    {
      chainId: 421614,
      address: TOKEN_TRANSFERER,
      nonce: currentNonce,
      yParity: 0 or 1,
      r: signatureR,
      s: signatureS
    }
  ]
}
```

## Pre-Transaction Checks

The script verifies:

- ✅ All environment variables are present
- ✅ RPC endpoint is reachable
- ✅ Service operator has ETH for gas
- ✅ Payment address has tokens to collect
- ✅ Token contract is accessible

## Example Output

```
╔════════════════════════════════════════════════════════════════════╗
║             Send EIP-7702 Transaction via ethers.js                ║
║                    Reference: https://eip7702.io/                  ║
╚════════════════════════════════════════════════════════════════════╝

Configuration:
  RPC URL              : https://sepolia-rollup.arbitrum.io/rpc
  Chain ID             : 421614
  Service Operator     : 0x...
  User Payment Address : 0x...
  Token Transferer     : 0x...
  Hot Wallet           : 0x...
  Test Token           : 0x...

Pre-Transaction State:
────────────────────────────────────────────────────────────────
  Service Operator ETH : 0.5 ETH
  Payment Address USDC : 100 USDC
  Hot Wallet USDC      : 0 USDC

Step 1: Create EIP-7702 Authorization
────────────────────────────────────────────────────────────────
  Payment Address Nonce: 0
  Digest: 0x...
  Signature (v, r, s):
    v (parity) : 0
    r          : 0x...
    s          : 0x...

Step 2: Prepare Transaction Data
────────────────────────────────────────────────────────────────
  To          : 0x...
  Data        : 0x...
  Value       : 0

Step 3: Estimate Gas
────────────────────────────────────────────────────────────────
  Gas Estimate: 100000
  Base Fee     : 0.1 gwei

Step 4: Build EIP-7702 Transaction
────────────────────────────────────────────────────────────────
  Transaction Structure:
    Type           : 0x04 (EIP-7702 Set Code)
    To             : 0x...
    Data           : 0x...
    Value          : 0
    Gas Limit      : 200000
    Gas Price      : 0.1 gwei
    Nonce          : 0
    Chain ID       : 421614

  Authorization List:
    [0]:
      chainId  : 421614
      address  : 0x...
      nonce    : 0
      yParity  : 0
      r        : 0x...
      s        : 0x...

Step 5: Send Transaction
────────────────────────────────────────────────────────────────
  Sending EIP-7702 transaction...
  ✓ Transaction submitted!
  Hash: 0x...

Step 6: Wait for Confirmation
────────────────────────────────────────────────────────────────
  Waiting for transaction confirmation...
  ✓ Transaction confirmed!
  Block Number : 12345678
  Gas Used     : 95000
  Status       : Success

Step 7: Verify Results
────────────────────────────────────────────────────────────────
  Payment Address USDC : 0 USDC
  Hot Wallet USDC      : 100 USDC

  Tokens Collected: 100 USDC

Transaction Summary:
────────────────────────────────────────────────────────────────
  ✓ Authorization created and signed
  ✓ Transaction sent via ethers.js
  ✓ Transaction mined
  ✓ Tokens collected successfully

Results:
────────────────────────────────────────────────────────────────
  Transaction Hash : 0x...
  Block Number     : 12345678
  Gas Used         : 95000
  Amount Collected : 100 USDC

View on Arbiscan:
  https://sepolia.arbiscan.io/tx/0x...
```

## Key Points

### Type 0x04 Support
- Requires RPC provider that supports EIP-7702
- ethers.js v6 may need custom handling
- ethers.js v7+ will have full EIP-7702 support

### Authorization List
- Can include multiple authorizations
- Each authorization has its own nonce
- Nonce prevents replay attacks

### Gas Considerations
- Script multiplies gas estimate by 2x for safety
- EIP-7702 transactions may use more gas
- Actual gas used depends on implementation

### Temporary Delegation
- Code delegation only lasts during transaction execution
- After transaction completes, address returns to EOA
- No permanent code changes

## Troubleshooting

### Error: "Missing environment variable"
```bash
cp .env.example .env
nano .env  # Fill in your values
```

### Error: "Service operator has no ETH"
- Fund service operator with testnet ETH
- Get ETH from Arbitrum Sepolia faucet

### Error: "Payment address has no tokens"
- Transfer test tokens to USER_PAYMENT_ADDR first
- Ensure it's on Arbitrum Sepolia

### Error: "RPC provider support"
- Ensure RPC endpoint supports EIP-7702
- Arbitrum Sepolia RPC has EIP-7702 support
- Some RPCs may not support Type 0x04 yet

### Error: "ethers.js Type 0x04 not supported"
- Use Foundry script as alternative:
  ```bash
  forge script script/OnChainTest.s.sol --broadcast
  ```
- Wait for ethers.js v7 full EIP-7702 support

## Environment Variables

Required:
```env
PRIVATE_KEY               # Service operator private key
HOT_WALLET               # Token destination address
TOKEN_TRANSFERER         # Implementation contract address
USER_PAYMENT_ADDR        # Payment address to delegate
USER_PAYMENT_PRIVATE_KEY # Payment address private key
TEST_TOKEN              # Token contract address
RPC_URL                 # RPC endpoint (optional, defaults to Arbitrum Sepolia)
```

## Workflow Options

### Option 1: ethers.js (This Script)
```bash
npx ts-node scripts/sendTransactionViaEthers.ts
```
- Requires ethers.js v6+ with Type 0x04 support
- Good for understanding flow
- May hit RPC limitations

### Option 2: Foundry (Recommended)
```bash
forge script script/OnChainTest.s.sol --broadcast
```
- Full EIP-7702 support built-in
- Better gas optimization
- More reliable

### Option 3: Combine Approaches
```bash
# Test with TypeScript
npx ts-node scripts/testWithdrawal.ts

# Send with Foundry
forge script script/OnChainTest.s.sol --broadcast
```

## References

- **EIP-7702 Spec**: https://eip7702.io/
- **ethers.js v6**: https://docs.ethers.org/v6/
- **Type 0x04**: Set Code Transaction
- **Arbitrum Sepolia**: Chain ID 421614

## Next Steps

1. Run the script: `npx ts-node scripts/sendTransactionViaEthers.ts`
2. Monitor transaction on Arbiscan
3. Verify tokens were collected
4. Check gas usage and optimization
5. Deploy to mainnet (use mainnet RPC)

