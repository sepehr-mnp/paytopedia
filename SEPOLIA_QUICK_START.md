# 🚀 Sepolia Deployment - Quick Start (5 Minutes)

## The Fastest Way to Deploy & Test

### 1️⃣ Set Your Private Key (30 seconds)
```bash
export PRIVATE_KEY=your_private_key_here
```

### 2️⃣ Deploy to Sepolia (2 minutes)
```bash
cd eip7702-payment-gateway

forge script script/DeployToSepolia.s.sol \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

**✅ Watch for output:**
```
TokenTransferer  : 0x...
PaymentGateway   : 0x...
USDC Token       : 0x...
USDT Token       : 0x...
```

### 3️⃣ Copy Addresses & Update Test Script (1 minute)

Open `script/SepoliaIntegrationTest.s.sol` and replace:
```solidity
// Line 16-19: Update with your deployed addresses
TokenTransferer public constant TOKEN_TRANSFERER = 0x...; // Paste here
TestERC20 public constant USDC = 0x...;                  // Paste here
TestERC20 public constant USDT = 0x...;                  // Paste here
```

### 4️⃣ Run Integration Test (2 minutes)
```bash
forge script script/SepoliaIntegrationTest.s.sol \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

**✅ Expected result:**
```
✅ ALL TESTS PASSED!
Real EIP-7702 delegation worked successfully on Sepolia!
```

---

## Troubleshooting (30 seconds)

| Error | Solution |
|-------|----------|
| "Private Key not set" | `export PRIVATE_KEY=your_key` |
| "Insufficient funds" | Get Sepolia ETH: https://www.infura.io/faucet/sepolia |
| "Invalid RPC" | Check RPC URL: https://rpc.sepolia.org |
| "Contract not found" | Wait 12 seconds after deploy, or update addresses |

---

## What Just Happened?

✅ **Deployed 4 smart contracts** to Sepolia testnet
✅ **Created real EIP-7702 authorizations** with ECDSA signatures
✅ **Transferred tokens** using code delegation
✅ **Verified everything** works end-to-end

---

## Next: View on Etherscan

Copy-paste your contract address here:
```
https://sepolia.etherscan.io/address/0x...
```

---

## Key Commands

```bash
# Test locally first (no gas needed)
forge test --match-path "test-foundry/*"

# Deploy
forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast

# Test on Sepolia
forge script script/SepoliaIntegrationTest.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast

# View gas usage
forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast --gas-report
```

---

**That's it! You now have a real EIP-7702 payment gateway running on Sepolia! 🎉**

For more details, see: `SEPOLIA_DEPLOYMENT.md`
