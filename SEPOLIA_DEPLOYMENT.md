# Sepolia Deployment & Integration Test Guide

## Overview

This guide walks through deploying the EIP-7702 payment gateway to Sepolia testnet and running real integration tests with actual blockchain interactions.

## Prerequisites

### 1. Get Sepolia ETH
You need ETH on Sepolia testnet to pay for gas:
- Faucet: https://www.infura.io/faucet/sepolia
- Or: https://sepoliafaucet.com/

### 2. Set Environment Variables
```bash
# Create .env file in project root
export PRIVATE_KEY=your_private_key_here
export SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

Load environment:
```bash
source .env
```

### 3. Update Script Addresses

Before running, update these constants in the scripts:

**`script/DeployToSepolia.s.sol`:**
```solidity
address public constant HOT_WALLET = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; 
// ↑ Change to your hot wallet address
```

**`script/SepoliaIntegrationTest.s.sol`:**
```solidity
// After deployment, update these addresses:
TokenTransferer public constant TOKEN_TRANSFERER = 0x...;  // From deploy output
TestERC20 public constant USDC = 0x...;                    // From deploy output
TestERC20 public constant USDT = 0x...;                    // From deploy output
address public constant HOT_WALLET = 0x...;                // Your hot wallet
```

## Step 1: Deploy to Sepolia

### Run Deployment Script
```bash
cd eip7702-payment-gateway

forge script script/DeployToSepolia.s.sol \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Expected Output
```
🚀 DEPLOYING TO SEPOLIA TESTNET 🚀

Deployer Address: 0x...
Hot Wallet Address: 0x...

1️⃣  Deploying TokenTransferer...
   ✅ TokenTransferer deployed at: 0x...

2️⃣  Deploying PaymentGateway...
   ✅ PaymentGateway deployed at: 0x...

3️⃣  Deploying Test USDC Token...
   ✅ USDC deployed at: 0x...

4️⃣  Deploying Test USDT Token...
   ✅ USDT deployed at: 0x...

5️⃣  Minting Test Tokens...
   ✅ Minted 10000 USDC and 10000 USDT to deployer

✅ DEPLOYMENT COMPLETE ✅

📋 DEPLOYMENT SUMMARY:
TokenTransferer  : 0x...
PaymentGateway   : 0x...
USDC Token       : 0x...
USDT Token       : 0x...
Hot Wallet       : 0x...
Deployer         : 0x...

💾 Save these addresses for integration tests!
🔗 View on Sepolia Etherscan:
   https://sepolia.etherscan.io/address/0x...
```

### Save Addresses
Copy the deployed addresses and update `script/SepoliaIntegrationTest.s.sol`:

```solidity
// Update these with your deployed addresses
TokenTransferer public constant TOKEN_TRANSFERER = 0x...; // Copy from output
TestERC20 public constant USDC = 0x...;                  // Copy from output
TestERC20 public constant USDT = 0x...;                  // Copy from output
```

## Step 2: Fund Test Users (Optional but Recommended)

For better testing, fund the test user addresses:

```bash
# Get test user addresses
cast call $(cast calldata "vm.addr(uint256)" 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)

# Transfer ETH to test users (using cast)
cast send 0x... --value 1ether --private-key $PRIVATE_KEY --rpc-url https://rpc.sepolia.org
```

## Step 3: Run Integration Test

### Execute Integration Test
```bash
forge script script/SepoliaIntegrationTest.s.sol \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Expected Output
```
🧪 SEPOLIA INTEGRATION TEST - EIP-7702 🧪

📋 TEST CONFIGURATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deployer       : 0x...
User1          : 0x...
User2          : 0x...
Hot Wallet     : 0x...
TokenTransferer: 0x...
USDC           : 0x...
USDT           : 0x...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TEST 1: Initial Balances
User1 USDC Balance: 100 tokens
User1 USDT Balance: 50 tokens
User2 USDC Balance: 75 tokens
Hot Wallet USDC Before: 0 tokens

💰 TEST 2: Users Send Tokens to Payment Addresses
User1 transferring 50 USDC to payment address...
✅ User1 transfer complete
User2 transferring 30 USDC to payment address...
✅ User2 transfer complete

🔐 TEST 3: Create EIP-7702 Authorizations
✅ Authorization 1 created for User1
   Nonce: 1
   Implementation: 0x...
✅ Authorization 2 created for User2
   Nonce: 1
   Implementation: 0x...

🚀 TEST 4: Collect Tokens with EIP-7702 Delegation
Collecting from User1...
✅ User1 tokens collected via EIP-7702
Collecting from User2...
✅ User2 tokens collected via EIP-7702

📊 TEST 5: Final Balances & Verification

User1 USDC:
  Before: 150 tokens
  After : 100 tokens
  Collected: 50 tokens

User2 USDC:
  Before: 75 tokens
  After : 45 tokens
  Collected: 30 tokens

Hot Wallet USDC:
  Before: 0 tokens
  After : 80 tokens
  Received: 80 tokens

✅ TEST COMPLETE ✅

✅ ALL TESTS PASSED!

Real EIP-7702 delegation worked successfully on Sepolia!
Tokens were collected from payment addresses to hot wallet.

🔗 View Transactions on Sepolia Etherscan:
   https://sepolia.etherscan.io/
```

## Step 4: Verify on Etherscan

### View Deployment
Visit the contract addresses on Sepolia Etherscan:
- https://sepolia.etherscan.io/address/[TokenTransferer_Address]
- https://sepolia.etherscan.io/address/[PaymentGateway_Address]
- https://sepolia.etherscan.io/address/[USDC_Address]

### Check Transactions
Find transactions in block explorer and verify:
- ✅ TokenTransferer deployment
- ✅ PaymentGateway deployment
- ✅ Token deployments
- ✅ Token transfers
- ✅ Token collection transactions

## Troubleshooting

### Error: "Private Key not set"
**Solution:** Set PRIVATE_KEY environment variable
```bash
export PRIVATE_KEY=your_private_key_here
source .env
```

### Error: "Insufficient funds"
**Solution:** Get more Sepolia ETH from faucet
- https://www.infura.io/faucet/sepolia
- https://sepoliafaucet.com/

### Error: "Contract verification failed"
**Solution:** Verify manually on Etherscan with correct constructor arguments

### Error: "RPC rate limit exceeded"
**Solution:** Wait a moment and retry, or use different RPC provider
```bash
# Alternative RPC URLs:
https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
https://rpc.ankr.com/eth_sepolia
```

### Transactions Stuck/Pending
**Solution:** Check gas price
```bash
# View current gas price
cast gas-price --rpc-url https://rpc.sepolia.org

# Increase gas price if needed
forge script ... --gas-price 50gwei
```

## Advanced: Custom Integration Tests

You can modify the integration test to:

### Test Different Token Amounts
```solidity
uint256 user1SendAmount = 100 ether;  // Change amount
uint256 user2SendAmount = 50 ether;   // Change amount
```

### Test with More Users
Add more users to the test:
```solidity
uint256 public constant USER3_PK = 0x...;  // New user
address user3Addr = vm.addr(USER3_PK);

// Create authorization and collect
Vm.SignedDelegation memory auth3 = vm.signDelegation(address(TOKEN_TRANSFERER), USER3_PK);
vm.attachDelegation(auth3);
TOKEN_TRANSFERER.transfer(address(USDC), HOT_WALLET);
```

### Test Multiple Token Types
```solidity
// Collect USDC
vm.attachDelegation(auth1);
TOKEN_TRANSFERER.transfer(address(USDC), HOT_WALLET);

// Collect USDT (create new auth)
Vm.SignedDelegation memory auth1_usdt = vm.signDelegation(address(TOKEN_TRANSFERER), USER1_PK);
vm.attachDelegation(auth1_usdt);
TOKEN_TRANSFERER.transfer(address(USDT), HOT_WALLET);
```

## Production Checklist

Before mainnet deployment:

- [ ] Test on Sepolia successfully
- [ ] Verify contract behavior matches expectations
- [ ] Review gas costs (from transaction receipt)
- [ ] Check all events are emitted correctly
- [ ] Verify hot wallet receives tokens
- [ ] Test with real token addresses (when mainnet ready)
- [ ] Set correct owner and permissions
- [ ] Verify contract upgradability (if needed)

## Key Commands Reference

### Compile
```bash
forge build
```

### Test Locally First
```bash
forge test --match-path "test-foundry/*"
```

### Deploy to Sepolia
```bash
forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast
```

### Run Integration Test
```bash
forge script script/SepoliaIntegrationTest.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast
```

### Verify Contract on Etherscan (Optional)
```bash
forge verify-contract [ADDRESS] TokenTransferer --chain sepolia --etherscan-api-key $ETHERSCAN_KEY
```

### Check Gas Usage
```bash
forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key $PRIVATE_KEY --broadcast --gas-report
```

## Network Details

**Sepolia Testnet:**
- Chain ID: 11155111
- RPC: https://rpc.sepolia.org
- Block Explorer: https://sepolia.etherscan.io
- Faucet: https://www.infura.io/faucet/sepolia

## Success Indicators

✅ Scripts run without errors
✅ Contracts deploy successfully
✅ Token transfers work
✅ EIP-7702 delegations created
✅ Tokens collected to hot wallet
✅ All balances verify correctly
✅ Transactions visible on Etherscan

## Next Steps

1. **Local Testing**: `forge test --match-path "test-foundry/*"`
2. **Deploy to Sepolia**: Run DeployToSepolia.s.sol
3. **Integration Testing**: Run SepoliaIntegrationTest.s.sol
4. **Verify on Etherscan**: Check contract code and transactions
5. **Production Ready**: When EIP-7702 goes mainnet, deploy with same contracts

## Resources

- [Foundry Documentation](https://book.getfoundry.sh/)
- [Sepolia Testnet](https://sepolia.etherscan.io/)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Foundry Scripts Guide](https://book.getfoundry.sh/tutorials/solidity-scripting)

---

**Ready to deploy?** Run the deployment script and watch your EIP-7702 payment gateway come to life on Sepolia! 🚀
