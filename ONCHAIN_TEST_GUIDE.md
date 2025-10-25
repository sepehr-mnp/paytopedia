# EIP-7702 Payment Gateway - On-Chain Test Guide

This guide explains how to run the on-chain integration tests for the EIP-7702 payment gateway service on Arbitrum Sepolia.

## Overview

The on-chain test suite validates the complete EIP-7702 token collection workflow:

1. **EIP-7702 Authorization** - Service creates a delegation authorization
2. **Code Attachment** - TokenTransferer code is temporarily attached to the user's payment address
3. **Token Collection** - Service calls transfer to collect all tokens to the hot wallet
4. **Verification** - Balances are verified to confirm successful collection

## Prerequisites

### 1. Deployed Contracts

First, deploy the contracts to Arbitrum Sepolia:

```bash
# Deploy contracts
forge script script/DeployToSepolia.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast --verify \
  --etherscan-api-key <YOUR_ARBISCAN_API_KEY> \
  --verifier-url https://api-sepolia.arbiscan.io/api
```

This will output the deployed contract addresses. Save them for the next step.

### 2. Create/Fund Test Accounts

You need two key pieces of information:

**A. Payment Address (Off-Chain Generated)**

Generate a deterministic payment address off-chain (example using ethers.js):

```javascript
const ethers = require('ethers');

// Generate a deterministic private key
const privateKey = '0x...'; // Your generated private key (MUST NOT be your main key!)
const wallet = new ethers.Wallet(privateKey);
console.log('Payment Address:', wallet.address);
console.log('Private Key:', privateKey);
```

**B. Fund the Payment Address**

Send test tokens (USDC, USDT, etc.) to the payment address on Arbitrum Sepolia:

```bash
# Using a simple transfer from your main wallet
# (In production, users would send tokens to their payment address)
```

### 3. Prepare Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```env
# Your service operator private key
PRIVATE_KEY=0x...

# Addresses from deployment
HOT_WALLET=0x...
PAYMENT_GATEWAY=0x...
TOKEN_TRANSFERER=0x...

# Payment address details (from step 2)
USER_PAYMENT_ADDR=0x...
USER_PAYMENT_PRIVATE_KEY=0x...

# Token to test with
TEST_TOKEN=0x...
```

## Running On-Chain Tests

### Option 1: Run with Broadcasting (Production Simulation)

This simulates a real service collecting tokens:

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

### Option 2: Run Dry Run First (Recommended)

Test without broadcasting to verify everything works:

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

### Option 3: Run with Full Details

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast \
  -vvv
```

## Test Flow

The `OnChainTest.s.sol` script performs these steps:

### TEST 1: Funding Payment Address
- Displays initial balances of payment address and hot wallet
- Shows token funding status

### TEST 2: Creating EIP-7702 Authorization
- Signs EIP-7702 delegation using user's payment address private key
- Displays authorization details (nonce, implementation, signatures)

### TEST 3: Collecting Tokens with EIP-7702
- Attaches the delegation authorization
- Calls transfer on delegated payment address
- TokenTransferer code temporarily executes via EIP-7702
- Collects all tokens to hot wallet

### TEST 4: Verifying Results
- Checks final balances
- Confirms tokens moved from payment address to hot wallet
- Verifies payment address is emptied

### TEST 5: Test Summary
- Displays overall results
- Shows total tokens collected

## Expected Output

```
╔════════════════════════════════════════════════╗
║  EIP-7702 Payment Gateway On-Chain Test Suite  ║
╚════════════════════════════════════════════════╝

Configuration:
  Service Operator    : 0x...
  Hot Wallet          : 0x...
  Payment Gateway     : 0x...
  Token Transferer    : 0x...
  User Payment Addr   : 0x...
  Test Token          : 0x...

Initial Balances:
  User Payment Address: 100000000000000000000
  Hot Wallet          : 0

[... test execution ...]

Final Balances:
  User Payment Address: 0
  Hot Wallet          : 100000000000000000000

Tokens Collected    : 100000000000000000000

Test Summary:
  [✓] EIP-7702 authorization created successfully
  [✓] Delegation attached to transaction
  [✓] Tokens collected from payment address
  [✓] Hot wallet received tokens
  [✓] Payment address emptied

╔════════════════════════════════════════════════╗
║           ✓ ALL TESTS PASSED ✓                 ║
╚════════════════════════════════════════════════╝
```

## Troubleshooting

### Error: "Invalid address"
- Check that all addresses in `.env` are valid Ethereum addresses (starting with 0x)
- Ensure addresses are checksummed correctly

### Error: "No tokens to transfer"
- The payment address must have token balance before running the test
- Fund the payment address with test tokens first

### Error: "Insufficient funds"
- The service operator account needs gas money on Arbitrum Sepolia
- Get testnet ETH from the Arbitrum Sepolia faucet

### EIP-7702 Not Supported
- Ensure you're using Foundry version with EIP-7702 support
- Update Foundry: `foundryup`

## Monitoring Transactions

After running tests, you can monitor transactions on Arbiscan:

- **User Payment Address**: https://sepolia.arbiscan.io/address/{USER_PAYMENT_ADDR}
- **Hot Wallet**: https://sepolia.arbiscan.io/address/{HOT_WALLET}
- **Token Contract**: https://sepolia.arbiscan.io/address/{TEST_TOKEN}

## Advanced: Multi-Token Testing

To test with multiple tokens, modify `.env` or create multiple test runs:

```bash
# Test with USDC
TEST_TOKEN=0x... forge script script/OnChainTest.s.sol --rpc-url ... --broadcast

# Test with USDT
TEST_TOKEN=0x... forge script script/OnChainTest.s.sol --rpc-url ... --broadcast
```

## Security Notes

1. **Private Keys**: Never commit `.env` files with real private keys to version control
2. **Testnet Only**: Use only testnet accounts for testing
3. **Payment Address**: Generate payment addresses from secure sources
4. **Hot Wallet**: Use a secure multi-sig wallet for mainnet

## Next Steps

- Integrate the test suite into CI/CD pipelines
- Create similar tests for mainnet deployment
- Monitor gas usage for optimization
- Test with real user payment addresses

## Support

For issues or questions, refer to:
- Main README.md
- IMPLEMENTATION_GUIDE.md
- Foundry documentation: https://book.getfoundry.sh/

