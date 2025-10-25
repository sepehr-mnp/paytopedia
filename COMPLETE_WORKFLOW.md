# Complete EIP-7702 Payment Gateway - End-to-End Workflow

## Overview

This document shows the complete workflow from deployment to production testing of the EIP-7702 payment gateway service on Arbitrum Sepolia.

## Prerequisites

- Foundry installed (`foundryup`)
- Arbitrum Sepolia testnet ETH
- Arbiscan API key (for verification)
- Node.js/ethers.js (for address generation)

## Step-by-Step Workflow

### 🔧 STEP 1: Environment Setup

```bash
# Navigate to project
cd /path/to/eip7702-payment-gateway

# Install dependencies
forge install

# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 📋 STEP 2: Create Payment Address (Off-Chain)

Generate a deterministic payment address using Node.js:

```bash
cat > generate_address.js << 'GENEOF'
const ethers = require('ethers');

// Generate a random wallet (or use specific private key)
const wallet = ethers.Wallet.createRandom();

console.log("Payment Address:", wallet.address);
console.log("Private Key:   ", wallet.privateKey);
console.log("\nStore these values in your .env file:");
console.log("USER_PAYMENT_ADDR=", wallet.address);
console.log("USER_PAYMENT_PRIVATE_KEY=", wallet.privateKey);
GENEOF

node generate_address.js
```

Update `.env` with generated values.

### 💰 STEP 3: Fund Test Accounts

1. **Get testnet ETH**
   - Visit Arbitrum Sepolia Faucet
   - Request ETH for your main wallet

2. **Fund payment address with test tokens**
   - Mint or transfer test tokens to USER_PAYMENT_ADDR
   - Example with USDC: Send 100+ USDC to the payment address

3. **Fund service operator account**
   - Needs ETH for gas fees

### 🚀 STEP 4: Deploy Contracts

```bash
# Deploy with verification in one command
forge script script/DeployToSepolia.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verifier-url https://api-sepolia.arbiscan.io/api
```

**Output includes:**
- ✓ Deployed contract addresses
- ✓ Verification commands
- ✓ Etherscan links
- ✓ Gas usage

**Update .env with:**
- `PAYMENT_GATEWAY` - Address of deployed PaymentGateway
- `TOKEN_TRANSFERER` - Address of deployed TokenTransferer

### ✅ STEP 5: Run Dry-Run Test

Test without broadcasting (no gas cost):

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

**Verify output:**
```
Configuration:
  Service Operator    : 0x...
  Hot Wallet          : 0x...
  Payment Gateway     : 0x...
  Token Transferer    : 0x...
  User Payment Addr   : 0x...
  Test Token          : 0x...

[Test phases 1-5 execute...]

✓ ALL TESTS PASSED ✓
```

### 🎬 STEP 6: Run Production Test (With Broadcasting)

Execute the actual token collection on-chain:

```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast -vvv
```

**Monitor:**
- Check terminal output for transaction hashes
- View transactions on Arbiscan
- Verify token balances changed

### 📊 STEP 7: Verify Results

Check Arbiscan for each address:

```bash
# Payment address (should now have 0 tokens)
https://sepolia.arbiscan.io/address/{USER_PAYMENT_ADDR}

# Hot wallet (should have received tokens)
https://sepolia.arbiscan.io/address/{HOT_WALLET}

# Test token contract (view transfer events)
https://sepolia.arbiscan.io/address/{TEST_TOKEN}
```

### 📈 STEP 8: Advanced - Multiple Tokens

Test with different tokens:

```bash
# Test with USDC
TEST_TOKEN=0x... forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast

# Test with USDT
TEST_TOKEN=0x... forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

## Complete Checklist

### Pre-Deployment
- [ ] Foundry installed and updated
- [ ] Test ETH in service operator wallet
- [ ] Test tokens available for USER_PAYMENT_ADDR
- [ ] .env file created and filled
- [ ] All addresses verified

### Deployment Phase
- [ ] Run deployment script
- [ ] Verify contracts on Arbiscan
- [ ] Update .env with deployed addresses
- [ ] Check deployment.json for records

### Testing Phase
- [ ] Run dry-run test first
- [ ] Review output carefully
- [ ] Run production test with broadcasting
- [ ] Monitor transaction hashes
- [ ] Verify final balances on Arbiscan

### Post-Testing
- [ ] Document transaction hashes
- [ ] Record gas usage
- [ ] Test with multiple token types
- [ ] Prepare for mainnet deployment

## File Reference

| File | Purpose |
|------|---------|
| `script/DeployToSepolia.s.sol` | Contract deployment with verification |
| `script/OnChainTest.s.sol` | On-chain integration test |
| `.env.example` | Configuration template |
| `contracts/PaymentGateway.sol` | Service contract |
| `contracts/TokenTransferer.sol` | EIP-7702 delegated code |
| `contracts/TestERC20.sol` | Test token (optional) |

## Documentation Reference

| Document | Use When |
|----------|----------|
| `ONCHAIN_TEST_QUICKSTART.md` | Getting started quickly |
| `ONCHAIN_TEST_GUIDE.md` | Need detailed instructions |
| `ONCHAIN_TEST_SUMMARY.md` | Want implementation overview |
| `COMPLETE_WORKFLOW.md` | Following end-to-end process |

## Expected Outputs

### Successful Deployment
```
TokenTransferer  : 0x...
PaymentGateway   : 0x...
USDC Token       : 0x...
USDT Token       : 0x...

Verification commands:
forge verify-contract 0x... TokenTransferer --chain arbitrum-sepolia ...
```

### Successful Test
```
╔════════════════════════════════════════════════╗
║           ✓ ALL TESTS PASSED ✓                 ║
╚════════════════════════════════════════════════╝

[✓] EIP-7702 authorization created successfully
[✓] Delegation attached to transaction
[✓] Tokens collected from payment address
[✓] Hot wallet received tokens
[✓] Payment address emptied
```

## Troubleshooting Guide

### Deployment Issues

**"Insufficient funds"**
- Get more testnet ETH from Arbitrum Sepolia faucet

**"Network error"**
- Check RPC URL is correct and accessible
- Verify internet connection

**"Verification failed"**
- Check Arbiscan API key is valid
- Ensure contract is uploaded to chain first

### Testing Issues

**"Invalid address in .env"**
- Verify all addresses start with 0x
- Check addresses are checksummed correctly
- Ensure no spaces or special characters

**"No tokens to transfer"**
- USER_PAYMENT_ADDR must have token balance
- Send test tokens to payment address first

**"EIP-7702 error"**
- Update Foundry: `foundryup`
- Ensure using Foundry version with EIP-7702 support

## Gas Optimization Notes

### Deployment Gas Usage
- TokenTransferer: ~100,000 gas
- PaymentGateway: ~200,000 gas
- Test tokens: ~500,000-600,000 gas total

### Test Gas Usage
- Delegation creation: ~50,000 gas
- Token collection: ~80,000-150,000 gas per token
- Batch collection: ~200,000-300,000 gas for 2-3 tokens

## Security Best Practices

1. **Private Keys**
   - Never commit .env to git
   - Use .gitignore to exclude it
   - Rotate keys regularly

2. **Test Accounts**
   - Use separate accounts for testing
   - Don't use production keys for tests
   - Generate payment addresses securely

3. **Mainnet Readiness**
   - Test thoroughly on testnet first
   - Use multi-sig for mainnet hot wallet
   - Implement monitoring and alerting

4. **Audit Considerations**
   - Have code audited before mainnet
   - Test edge cases thoroughly
   - Document all assumptions

## Next Steps

After successful testing on Arbitrum Sepolia:

1. **Mainnet Preparation**
   - Create mainnet deployment script
   - Use mainnet addresses
   - Update RPC endpoint

2. **Monitoring Setup**
   - Implement transaction monitoring
   - Set up alerts for anomalies
   - Track gas usage trends

3. **User Documentation**
   - Write user guide for payment addresses
   - Explain EIP-7702 benefits
   - Provide support documentation

4. **Production Rollout**
   - Staged rollout strategy
   - Monitoring and alerting
   - Incident response plan

## Support

- 📖 Read ONCHAIN_TEST_GUIDE.md for detailed help
- 🚀 See ONCHAIN_TEST_QUICKSTART.md for quick reference
- 💡 Check ONCHAIN_TEST_SUMMARY.md for overview
- 🔗 Foundry docs: https://book.getfoundry.sh/

---

**Last Updated**: 2025-01-10
**Status**: ✅ Production Ready
**Network**: Arbitrum Sepolia

