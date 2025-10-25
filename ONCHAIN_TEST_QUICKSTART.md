# On-Chain Test - Quick Start

## 1️⃣ Setup Environment

```bash
# Copy env template
cp .env.example .env

# Edit .env with your values
nano .env
```

Required `.env` variables:
```env
PRIVATE_KEY=0x...              # Service operator key
HOT_WALLET=0x...              # Token collection address
PAYMENT_GATEWAY=0x...         # Deployed PaymentGateway address
TOKEN_TRANSFERER=0x...        # Deployed TokenTransferer address
USER_PAYMENT_ADDR=0x...       # User's payment address
USER_PAYMENT_PRIVATE_KEY=0x...# Payment address private key
TEST_TOKEN=0x...              # Token contract to test with
```

## 2️⃣ Deploy Contracts (if not already done)

```bash
forge script script/DeployToSepolia.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verifier-url https://api-sepolia.arbiscan.io/api
```

## 3️⃣ Fund Payment Address

Send test tokens to `USER_PAYMENT_ADDR` on Arbitrum Sepolia using your wallet.

## 4️⃣ Run On-Chain Test

**Option A: Dry run (no gas cost)**
```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

**Option B: Broadcast (with gas cost)**
```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast
```

**Option C: Verbose output**
```bash
forge script script/OnChainTest.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast -vvv
```

## ✅ Success Indicators

If tests pass, you'll see:

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

## 🔍 Monitor Results

Check transactions on Arbiscan:
- Payment Address: `https://sepolia.arbiscan.io/address/{USER_PAYMENT_ADDR}`
- Hot Wallet: `https://sepolia.arbiscan.io/address/{HOT_WALLET}`

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid address" | Check `.env` - all addresses must be valid and checksummed |
| "No tokens to transfer" | Fund payment address with test tokens first |
| "Insufficient funds" | Get testnet ETH from Arbitrum Sepolia faucet |
| "EIP-7702 not supported" | Update Foundry: `foundryup` |

## 📊 Test Phases

1. **Configuration** - Loads and validates all environment variables
2. **Initialization** - Gets initial token balances
3. **EIP-7702 Authorization** - Creates delegation signature
4. **Token Collection** - Executes transfer with delegation
5. **Verification** - Confirms tokens were collected
6. **Summary** - Reports test results

## 🚀 Next Steps

- Integrate into CI/CD pipeline
- Test with multiple tokens
- Deploy to mainnet (use mainnet addresses)
- Monitor gas usage for optimization

For detailed information, see `ONCHAIN_TEST_GUIDE.md`
