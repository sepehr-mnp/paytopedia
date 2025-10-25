# Quick Start Guide - EIP-7702 Payment Gateway

Get up and running with the EIP-7702 Payment Gateway in 5 minutes!

## 1. Installation

```bash
cd eip7702-payment-gateway
npm install
```

## 2. Run Tests

Verify everything works:

```bash
npm test
```

You should see **32 tests passing** ✅

## 3. Deploy Contracts Locally

Deploy to the hardhat network:

```bash
npm run deploy:local
```

This will output:
- `TokenTransferer` address
- `PaymentGateway` address
- Deployment details saved to `deployment.json`

## 4. Core Components

### PaymentGateway Contract
- Manages user payment addresses
- Tracks which addresses belong to which users
- Configurable hot wallet for receiving tokens
- Owner-controlled access

### TokenTransferer Contract
- Designed to be delegated to via EIP-7702
- Two main functions:
  - `transfer(token, recipient)` - Transfer one token
  - `transferMultiple(tokens[], recipient)` - Transfer multiple tokens

### JavaScript Utilities
Located in `scripts/eip7702Utils.js`:
- `encodeEIP7702Authorization()` - Create EIP-7702 authorizations
- `prepareTokenTransferTx()` - Prepare transfer transactions
- `prepareBatchTokenTransferTx()` - Prepare batch transfers
- `validateAuthorization()` - Validate authorizations

## 5. Workflow: How It Works

### For Service Operators:

```
1. Create random wallet address for each user
   → Wallet A, Wallet B, Wallet C, etc.

2. User sends tokens to their assigned wallet
   → User sends USDC to Wallet A

3. Service signs EIP-7702 authorization
   → Signs with Wallet A's private key
   → Delegates code to TokenTransferer

4. Service sends ONE transaction
   → Calls TokenTransferer.transfer()
   → All tokens move to hot wallet atomically

5. Tokens now in hot wallet!
   → Ready for processing, swapping, etc.
```

### Key Innovation:
- **Traditional**: Need to send ETH to each address + make separate transactions
- **EIP-7702**: Service just signs once + makes one transaction per collection batch

## 6. File Structure

```
contracts/
  ├── TokenTransferer.sol      # Delegated contract
  ├── PaymentGateway.sol       # Service contract  
  └── TestERC20.sol            # Test token

scripts/
  ├── deploy.js                # Deployment script
  └── eip7702Utils.js          # Utility functions

test/
  ├── PaymentGateway.test.js   # Gateway tests (20 tests)
  └── TokenTransferer.test.js  # Transferer tests (12 tests)

README.md                       # Full documentation
IMPLEMENTATION_GUIDE.md        # Detailed implementation guide
QUICK_START.md                 # This file
deployment.json                # Generated after deployment
```

## 7. Testing Specific Features

Run specific test suites:

```bash
# Test PaymentGateway only
npm test -- --grep "PaymentGateway"

# Test TokenTransferer only
npm test -- --grep "TokenTransferer"

# Test single token transfer
npm test -- --grep "Should transfer all tokens"

# Test batch transfers
npm test -- --grep "transferMultiple"
```

## 8. Gas Optimization Highlights

From test output:
- **PaymentGateway deployment**: ~727 KB
- **TokenTransferer deployment**: ~408 KB  
- **Single token transfer**: ~51.4K gas
- **Batch token transfer (2 tokens)**: ~70K gas

This is highly optimized for batch operations!

## 9. Network Support

Currently configured for:
- **Hardhat** (local development)
- **Sepolia** (testnet)

To deploy to Sepolia:
```bash
PRIVATE_KEY=your_key SEPOLIA_RPC_URL=your_rpc npm run deploy:sepolia
```

## 10. Security Features

- Access control on all admin functions
- Chain ID validation to prevent cross-chain attacks
- Authorization nonce to prevent replay attacks
- Zero address validations
- Token approval not needed (EIP-7702 advantage)

## 11. Next Steps

1. **Review the contracts**: Check `contracts/` folder
2. **Study the utilities**: See `scripts/eip7702Utils.js`
3. **Read implementation guide**: See `IMPLEMENTATION_GUIDE.md`
4. **Deploy on testnet**: Use Sepolia RPC

## 12. Troubleshooting

**"Module not found"**
```bash
npm install --legacy-peer-deps
```

**"Cannot find module '@nomicfoundation/hardhat-...'"**
```bash
npm install
```

**"Tests not running"**
```bash
npm run compile
npm test
```

## 13. Key Concepts

### What is EIP-7702?

EIP-7702 allows temporary code delegation on an address. This means:
- Address A temporarily gets code of Contract B
- Contract B functions can execute "as" Address A
- After execution, Address A reverts to normal

### Why It's Powerful for Payments

1. **No upfront funding**: Don't need to send ETH to payment addresses
2. **Atomic operations**: All tokens transfer in one transaction
3. **Lower costs**: One transaction per batch instead of many
4. **Better UX**: Simpler payment flow for users

## 14. Deployment Checklist

Before mainnet deployment:

- [ ] Run all tests: `npm test`
- [ ] Check gas reports
- [ ] Audit private key management
- [ ] Set up secure key storage
- [ ] Configure rate limiting
- [ ] Test on Sepolia first
- [ ] Verify contract addresses
- [ ] Set up monitoring
- [ ] Document procedures

## 15. Support

For issues:
1. Check `IMPLEMENTATION_GUIDE.md`
2. Review test files for examples
3. Check contract comments
4. Verify Hardhat is properly installed

Happy deploying! 🚀
