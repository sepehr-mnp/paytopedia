# TypeScript On-Chain Withdrawal Test Guide

## Overview

The `scripts/testWithdrawal.ts` script tests the EIP-7702 payment gateway withdrawal process using TypeScript and ethers.js v6.

It validates:
- Environment configuration
- Token contract connectivity
- Balance verification
- EIP-7702 delegation signature generation
- Signature verification

## Setup

### 1. Install Dependencies

```bash
npm install ethers dotenv
npm install --save-dev typescript ts-node @types/node
```

### 2. Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["scripts/**/*"],
  "exclude": ["node_modules"]
}
```

### 3. Configure .env

```env
# Service operator
PRIVATE_KEY=0x...

# Addresses
HOT_WALLET=0x...
PAYMENT_GATEWAY=0x...
TOKEN_TRANSFERER=0x...
USER_PAYMENT_ADDR=0x...
USER_PAYMENT_PRIVATE_KEY=0x...
TEST_TOKEN=0x...

# RPC (optional, defaults to Arbitrum Sepolia)
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## Running the Test

### TypeScript (with ts-node)

```bash
npx ts-node scripts/testWithdrawal.ts
```

### Compiled JavaScript

```bash
npx tsc
node dist/scripts/testWithdrawal.js
```

## What the Script Does

### Step 1: Configuration Loading
- Reads all environment variables
- Validates required variables
- Initializes ethers.js provider and signers
- Connects to the blockchain

### Step 2: Contract Verification
- Retrieves token contract details (symbol, decimals)
- Gets initial balances of both addresses
- Validates payment address has tokens

### Step 3: Delegation Signature Creation
- Computes digest: `keccak256(abi.encode(chainId, nonce(0), implementation))`
- Signs digest using payment address private key
- Returns (v, r, s) signature components

### Step 4: Signature Verification
- Recovers signer address from signature
- Verifies recovered address matches payment address
- Confirms signature validity

### Step 5: Output
- Shows transaction structure
- Displays delegation parameters
- Provides next steps for on-chain execution

## Example Output

```
╔════════════════════════════════════════════════════════════════════╗
║         EIP-7702 Payment Gateway - On-Chain Withdrawal Test        ║
╚════════════════════════════════════════════════════════════════════╝

Configuration:
  RPC URL                : https://sepolia-rollup.arbitrum.io/rpc
  Service Operator       : 0x...
  Hot Wallet             : 0x...
  Token Transferer       : 0x...
  User Payment Address   : 0x...
  Test Token             : 0x...

  Chain ID               : 421614
  Chain Name             : arbitrumSepolia

Token Details:
  Symbol   : USDC
  Decimals : 6

Initial Balances:
  Payment Address  : 100 USDC
  Hot Wallet       : 0 USDC

Step 1: Creating delegation signature
────────────────────────────────────────────────────────────────
  Digest: 0x...
  ChainId: 421614
  Nonce: 0
  Implementation: 0x...

Step 2: Signature created
────────────────────────────────────────────────────────────────
  V: 27 (parity: 0)
  R: 0x...
  S: 0x...

Step 3: Simulating token collection
────────────────────────────────────────────────────────────────
  ⚠️  Note: EIP-7702 delegation requires blockchain support
  In production, this would be sent as part of a transaction
  with the delegation attached via RPC.

Expected Behavior:
────────────────────────────────────────────────────────────────
  1. Delegation is attached to transaction
  2. Payment address receives TokenTransferer code
  3. transfer() is called on delegated address
  4. All tokens are transferred to hot wallet
  5. Payment address returns to normal EOA state

Transaction Structure:
────────────────────────────────────────────────────────────────
  To: 0x...
  Data: TokenTransferer.transfer(0x..., 0x...)
  Delegation: {
    v: 0,
    r: 0x...,
    s: 0x...,
    nonce: 0,
    implementation: 0x...
  }

Signature Verification:
────────────────────────────────────────────────────────────────
  Signer: 0x...
  Recovered: 0x...
  Valid: true

Summary:
────────────────────────────────────────────────────────────────
  ✓ Environment variables loaded
  ✓ Token contract verified
  ✓ Balances retrieved
  ✓ Delegation digest created
  ✓ Signature generated and verified
  ✓ Ready for on-chain execution

Next Steps:
────────────────────────────────────────────────────────────────
  1. Use Foundry script for actual on-chain execution:
     forge script script/OnChainTest.s.sol --broadcast
  2. Monitor transaction: https://sepolia-rollup.arbitrum.io/rpc
  3. View results on Arbiscan: https://sepolia.arbiscan.io/
```

## Script Features

### Environment Validation
- Checks all required variables are present
- Helpful error messages if any are missing
- Auto-detects RPC URL (defaults to Arbitrum Sepolia)

### Balance Checking
- Retrieves balances with proper decimal formatting
- Warns if payment address is empty
- Prevents unnecessary operations

### Signature Generation
- Uses ethers.js v6 signing functions
- Creates proper EIP-7702 digest
- Includes nonce for replay protection

### Error Handling
- Comprehensive error messages
- Graceful fallback for missing tokens
- Helpful suggestions for troubleshooting

## Integration with Foundry

After the TypeScript test succeeds, execute the actual on-chain transaction:

```bash
# Run the Foundry test
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

The Foundry script will:
1. Use the same environment variables
2. Execute the actual EIP-7702 delegation
3. Collect tokens to the hot wallet
4. Verify the transaction on-chain

## Troubleshooting

### Missing environment variable error
```bash
# Ensure .env file exists and has all required variables
cp .env.example .env
nano .env  # Fill in your values
```

### Network connection error
- Check RPC_URL is correct
- Verify network connectivity
- Try a different RPC endpoint

### Signature verification failed
- Verify USER_PAYMENT_PRIVATE_KEY matches USER_PAYMENT_ADDR
- Check the private key format (should start with 0x)
- Ensure no whitespace in the key

### Token not found on chain
- Verify TEST_TOKEN address is correct
- Check token exists on the current chain
- Ensure it's deployed to Arbitrum Sepolia

## References

- [ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Arbitrum Sepolia RPC](https://sepolia-rollup.arbitrum.io/rpc)

## Related Files

- `script/OnChainTest.s.sol` - Foundry implementation
- `.env.example` - Environment template
- `contracts/TokenTransferer.sol` - Token collection contract
- `contracts/PaymentGateway.sol` - Gateway contract

