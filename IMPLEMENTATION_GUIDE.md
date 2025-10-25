# EIP-7702 Payment Gateway Implementation Guide

This guide explains how to integrate and use the EIP-7702 Payment Gateway in your application.

## Part 1: Setup & Deployment

### 1.1 Installation

```bash
npm install
```

### 1.2 Network Configuration

Edit `hardhat.config.js` to add your network:

```javascript
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

### 1.3 Deploy Contracts

```bash
# Deploy to local network
npx hardhat run scripts/deploy.js --network hardhat

# Deploy to Sepolia
PRIVATE_KEY=your_key npx hardhat run scripts/deploy.js --network sepolia
```

This creates `deployment.json` with contract addresses.

## Part 2: Architecture

### 2.1 Payment Address Generation

The service generates payment addresses for users (off-chain):

```javascript
const ethers = require("ethers");

function generatePaymentAddress() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

// For each user:
const paymentAddr = generatePaymentAddress();
// Store paymentAddr.address in database for user
// Store paymentAddr.privateKey securely (encrypted)
```

### 2.2 User Flow

```
1. User receives payment address from service
2. User sends tokens to payment address
3. Service monitors payment address for incoming tokens
4. Service collects tokens using EIP-7702 delegation
5. Tokens arrive at hot wallet
```

### 2.3 Service Architecture

```
┌─────────────────────────────────────────────────┐
│         Service Backend                         │
├─────────────────────────────────────────────────┤
│  • User Database                                │
│  • Payment Address Manager                      │
│  • EIP-7702 Authorization Signer                │
│  • Token Collection Service                     │
│  • Hot Wallet Manager                           │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│    Blockchain (Sepolia/Ethereum)                │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐  │
│  │ PaymentGateway Contract                 │  │
│  │  - Address Registration                 │  │
│  │  - Configuration Management             │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Payment Addresses (User-Owned)          │  │
│  │  - Receive tokens from users            │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ TokenTransferer (Delegated Code)        │  │
│  │  - transfer()                           │  │
│  │  - transferMultiple()                   │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Hot Wallet (Service Account)            │  │
│  │  - Receives all tokens                  │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Part 3: Token Collection Process

### 3.1 Step-by-Step Collection

#### Step 1: Monitor Payment Address

```javascript
const ethers = require("ethers");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const paymentAddress = "0x...";

async function monitorPaymentAddress() {
  const balance = await provider.getBalance(paymentAddress);
  console.log("Balance:", balance);
  
  // Check token balances
  const tokenBalance = await token.balanceOf(paymentAddress);
  console.log("Token Balance:", tokenBalance);
}
```

#### Step 2: Create EIP-7702 Authorization

```javascript
const { encodeEIP7702Authorization } = require("./scripts/eip7702Utils");

async function createAuthorization(paymentAddressPrivateKey) {
  const auth = await encodeEIP7702Authorization(
    paymentAddressPrivateKey,
    TOKEN_TRANSFERER_ADDRESS,
    chainId
  );
  
  return auth;
}
```

#### Step 3: Prepare Transfer Transaction

```javascript
async function prepareCollectionTx(
  paymentAddress,
  tokenAddress,
  recipientAddress
) {
  const iface = new ethers.Interface([
    "function transfer(address token, address recipient) public"
  ]);
  
  const callData = iface.encodeFunctionData("transfer", [
    tokenAddress,
    recipientAddress
  ]);
  
  return {
    to: paymentAddress,
    data: callData,
    value: 0,
    gasLimit: 200000,
  };
}
```

#### Step 4: Send Collection Transaction

```javascript
async function collectTokens(
  paymentAddress,
  tokenAddress,
  serviceWalletPrivateKey
) {
  const signer = new ethers.Wallet(serviceWalletPrivateKey, provider);
  
  // Get PaymentGateway deployment
  const deployment = require("./deployment.json");
  const hotWallet = deployment.hotWallet;
  
  // Prepare transaction
  const tx = await prepareCollectionTx(
    paymentAddress,
    tokenAddress,
    hotWallet
  );
  
  // Send transaction
  const receipt = await signer.sendTransaction(tx);
  await receipt.wait();
  
  console.log("Tokens collected:", receipt.hash);
}
```

### 3.2 Batch Collection

For multiple users/tokens:

```javascript
async function batchCollectTokens(
  paymentAddresses,
  tokenAddresses,
  serviceWalletPrivateKey
) {
  const signer = new ethers.Wallet(serviceWalletPrivateKey, provider);
  const deployment = require("./deployment.json");
  
  for (const paymentAddr of paymentAddresses) {
    // Check if address has tokens
    for (const tokenAddr of tokenAddresses) {
      const balance = await token.balanceOf(paymentAddr);
      
      if (balance > 0) {
        // Collect this token
        const tx = await prepareCollectionTx(
          paymentAddr,
          tokenAddr,
          deployment.hotWallet
        );
        
        await signer.sendTransaction(tx);
      }
    }
  }
}
```

### 3.3 Multi-Token Collection (Single Transaction)

```javascript
async function collectMultipleTokens(
  paymentAddress,
  tokenAddresses,
  serviceWalletPrivateKey
) {
  const signer = new ethers.Wallet(serviceWalletPrivateKey, provider);
  const deployment = require("./deployment.json");
  
  const iface = new ethers.Interface([
    "function transferMultiple(address[] calldata tokens, address recipient) public"
  ]);
  
  const callData = iface.encodeFunctionData("transferMultiple", [
    tokenAddresses,
    deployment.hotWallet
  ]);
  
  const tx = {
    to: paymentAddress,
    data: callData,
    gasLimit: 500000,
  };
  
  const receipt = await signer.sendTransaction(tx);
  await receipt.wait();
}
```

## Part 4: Integration Example

### 4.1 Complete Service Implementation

```javascript
// service.js
class PaymentGatewayService {
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.serviceWallet = new ethers.Wallet(config.privateKey, this.provider);
    this.deployment = require("./deployment.json");
    this.db = new Database(config.dbUrl);
  }

  async registerUser(userId) {
    // Generate payment address
    const wallet = ethers.Wallet.createRandom();
    
    // Register in contract
    const gateway = new ethers.Contract(
      this.deployment.paymentGateway,
      GATEWAY_ABI,
      this.serviceWallet
    );
    
    await gateway.registerPaymentAddress(userId, wallet.address);
    
    // Store securely
    await this.db.savePaymentAddress(userId, {
      address: wallet.address,
      privateKey: encrypt(wallet.privateKey, config.encryptionKey)
    });
    
    return wallet.address;
  }

  async collectTokens(userId, tokenAddress) {
    // Get payment address
    const paymentAddr = await this.db.getPaymentAddress(userId);
    const privateKey = decrypt(paymentAddr.privateKey, config.encryptionKey);
    
    // Prepare transaction
    const iface = new ethers.Interface([
      "function transfer(address token, address recipient) public"
    ]);
    
    const callData = iface.encodeFunctionData("transfer", [
      tokenAddress,
      this.deployment.hotWallet
    ]);
    
    // Send transaction
    const tx = {
      to: paymentAddr.address,
      data: callData,
    };
    
    const receipt = await this.serviceWallet.sendTransaction(tx);
    return receipt.hash;
  }

  async getPaymentAddresses(userId) {
    const gateway = new ethers.Contract(
      this.deployment.paymentGateway,
      GATEWAY_ABI,
      this.provider
    );
    
    return await gateway.getUserAddresses(userId);
  }
}

// Usage
const service = new PaymentGatewayService({
  rpcUrl: process.env.RPC_URL,
  privateKey: process.env.SERVICE_PRIVATE_KEY,
  dbUrl: process.env.DB_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
});

// Register user
const paymentAddr = await service.registerUser("user123");

// Collect tokens
const txHash = await service.collectTokens("user123", TOKEN_ADDRESS);
```

## Part 5: Security Best Practices

### 5.1 Private Key Management

```javascript
// ❌ DON'T
const privateKey = process.env.PRIVATE_KEY;

// ✅ DO - Use encrypted storage
const vault = new VaultManager();
const encrypted = vault.encrypt(privateKey);
// Store encrypted key in secure database
```

### 5.2 Authorization Nonce

```javascript
// Prevent replay attacks
async function getNextNonce(paymentAddress) {
  const nonce = await this.db.getAuthorization(paymentAddress);
  return nonce + 1;
}
```

### 5.3 Rate Limiting

```javascript
// Prevent abuse
async function checkRateLimit(userId) {
  const recentTxs = await this.db.getRecentTransactions(
    userId,
    3600 // 1 hour
  );
  
  if (recentTxs.length >= MAX_TRANSACTIONS_PER_HOUR) {
    throw new Error("Rate limit exceeded");
  }
}
```

### 5.4 Validation

```javascript
// Always validate
function validateTokenAddress(address) {
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid token address");
  }
  
  if (BLACKLISTED_TOKENS.includes(address)) {
    throw new Error("Token is blacklisted");
  }
}
```

## Part 6: Monitoring & Maintenance

### 6.1 Health Checks

```javascript
async function healthCheck() {
  // Check hot wallet
  const hotWalletBalance = await provider.getBalance(
    deployment.hotWallet
  );
  
  // Check contract
  const code = await provider.getCode(deployment.paymentGateway);
  
  return {
    hotWallet: hotWalletBalance > 0,
    contract: code !== "0x",
  };
}
```

### 6.2 Error Handling

```javascript
async function safeCollectTokens(userId, tokenAddress) {
  try {
    return await service.collectTokens(userId, tokenAddress);
  } catch (error) {
    if (error.code === "INSUFFICIENT_FUNDS") {
      // Top up service wallet
      await topUpServiceWallet();
    } else if (error.code === "NONCE_EXPIRED") {
      // Create new authorization
      return await service.collectTokens(userId, tokenAddress);
    }
    
    throw error;
  }
}
```

## Part 7: Testing

Run the test suite:

```bash
npm test
```

Test specific functionality:

```bash
npm test -- --grep "transferMultiple"
```

## Conclusion

The EIP-7702 Payment Gateway provides a secure, efficient, and scalable solution for token collection. Follow this guide to integrate it into your application.
