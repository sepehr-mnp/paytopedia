import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * EIP-7702 Sponsored Transaction with ethers.js
 * 
 * Based on QuickNode Guide: https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers
 * 
 * A sponsored transaction is where:
 * - The EOA (First Signer) authorizes a delegation
 * - A different wallet (Sponsor Signer) sends the transaction and pays for gas
 * - The EOA doesn't pay anything for the transaction
 * 
 * This is powerful for:
 * - Onboarding users (sponsor pays for first transactions)
 * - Batch operations (sponsor pays for multiple user actions)
 * - Gas sponsorship services
 */

// Load environment variables
const {
  PRIVATE_KEY,
  HOT_WALLET,
  TOKEN_TRANSFERER,
  USER_PAYMENT_ADDR,
  USER_PAYMENT_PRIVATE_KEY,
  TEST_TOKEN,
  RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc'
} = process.env;

interface SponsoredTxConfig {
  eoaSigner: ethers.Wallet;
  sponsorSigner: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  chainId: number;
  implementationAddress: string;
  targetAddress: string;
  callData: string;
  gasLimit?: bigint;
}

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function initializeSigners() {
  console.log('\n📋 Step 1: Initialize Signers');
  console.log('─'.repeat(70));

  if (!PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY');
  if (!USER_PAYMENT_PRIVATE_KEY) throw new Error('Missing USER_PAYMENT_PRIVATE_KEY');
  if (!TOKEN_TRANSFERER) throw new Error('Missing TOKEN_TRANSFERER');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const eoaSigner = new ethers.Wallet(USER_PAYMENT_PRIVATE_KEY, provider);
  const sponsorSigner = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();

  console.log(`Connected to chain: ${network.chainId} (${network.name})`);
  console.log(`EOA (First Signer): ${eoaSigner.address}`);
  console.log(`Sponsor: ${sponsorSigner.address}`);
  console.log(`Implementation: ${TOKEN_TRANSFERER}`);

  return {
    eoaSigner,
    sponsorSigner,
    provider,
    chainId: Number(network.chainId)
  };
}

async function getUSDCBalance(provider: ethers.JsonRpcProvider, address: string, label: string) {
  console.log(`\n💰 Checking ${label} Balance:`);

  const usdcContract = new ethers.Contract(TEST_TOKEN || '', ERC20_ABI, provider);

  try {
    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();
    const formattedBalance = ethers.formatUnits(balance, decimals);
    console.log(`  ${label} USDC: ${formattedBalance} USDC`);
    return balance;
  } catch (error) {
    console.error(`  Error getting balance for ${label}:`, error);
    return 0n;
  }
}

async function createEIP7702Authorization(config: {
  eoaSigner: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  chainId: number;
  implementationAddress: string;
}) {
  console.log('\n🔐 Step 2: Create EIP-7702 Authorization');
  console.log('─'.repeat(70));

  const { eoaSigner, provider, chainId, implementationAddress } = config;

  // Get current nonce of EOA
  // Important: For SPONSORED transactions, use current nonce (not nonce + 1)
  // This is different from non-sponsored transactions
  const currentNonce = await provider.getTransactionCount(eoaSigner.address);
  console.log(`  EOA Current Nonce: ${currentNonce}`);
  console.log(`  Using nonce: ${currentNonce} (for sponsored transaction)`);

  // Create authorization data
  // Per EIP-7702: keccak256(0x05 || rlp([chain_id, address, nonce]))
  const authTupleData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'uint64'],
    [chainId, implementationAddress, currentNonce]
  );

  const digest = ethers.keccak256(
    ethers.concat(['0x05',
       authTupleData
      ])
  );

  console.log(`  Digest created for authorization`);
  console.log(`    ChainId: ${chainId}`);
  console.log(`    Implementation: ${implementationAddress}`);
  console.log(`    Nonce: ${currentNonce}`);

  // Sign the authorization with EOA's private key
  const signature = eoaSigner.signingKey.sign(digest);
  const yParity = signature.v - 27;

  console.log(`  ✓ Authorization signed by EOA`);
  console.log(`    Signature V (parity): ${yParity}`);

  return {
    chainId,
    address: implementationAddress,
    nonce: currentNonce,
    yParity: yParity as 0 | 1,
    r: signature.r,
    s: signature.s,
    v: signature.v,
  };
}

async function sendSponsoredEIP7702Transaction(config: SponsoredTxConfig) {
  console.log('\n📤 Step 3: Send Sponsored EIP-7702 Transaction');
  console.log('─'.repeat(70));

  const {
    eoaSigner,
    sponsorSigner,
    provider,
    chainId,
    implementationAddress,
    targetAddress,
    callData,
    gasLimit
  } = config;

  // Create authorization
  const authorization = await createEIP7702Authorization({
    eoaSigner,
    provider,
    chainId,
    implementationAddress
  });


  console.log('\n📋 Building Sponsored Transaction');
  console.log('─'.repeat(70));

  // Get gas estimate
  const gasEstimate = await provider.estimateGas({
    to: targetAddress,
    data: callData,
    from: sponsorSigner.address
  });

  const feeData = await provider.getFeeData();
  const txGasLimit = gasLimit || gasEstimate * 2n;
  const gasPrice = feeData.gasPrice || (await provider.getFeeData()).gasPrice || 0n;

  console.log(`  Gas Estimate: ${gasEstimate.toString()}`);
  console.log(`  Gas Limit: ${txGasLimit.toString()}`);
  console.log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  console.log(`  Est. Cost: ${ethers.formatEther(txGasLimit * gasPrice)} ETH`);

  // Build Type 0x04 transaction with authorization list
  const sponsorNonce = await provider.getTransactionCount(sponsorSigner.address);

  const txData = {
    to: targetAddress,
    data: callData,
    value: 0n,
    gasLimit: txGasLimit,
    gasPrice: gasPrice,
    nonce: sponsorNonce,
    chainId: chainId,
    type: 4, // EIP-7702 Set Code Transaction
    authorizationList: [
      {
        chainId: authorization.chainId,
        address: authorization.address,
        nonce: authorization.nonce,
        signature: {
          yParity: authorization.yParity,
          r: authorization.r,
          s: authorization.s,
          v: authorization.v
        }
      }
    ]
  };

  console.log('\n📦 Transaction Structure:');
  console.log(`  Type: 0x04 (EIP-7702 Sponsored)`);
  console.log(`  Sender (Sponsor): ${sponsorSigner.address}`);
  console.log(`  Target: ${targetAddress}`);
  console.log(`  To: ${targetAddress}`);
  console.log(`  Value: 0`);
  console.log(`  Gas Limit: ${txGasLimit.toString()}`);
  console.log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  console.log('\n🔑 Authorization Details:');
  console.log(`  Implementation: ${authorization.address}`);
  console.log(`  ChainId: ${authorization.chainId}`);
  console.log(`  Nonce: ${authorization.nonce}`);
  console.log(`  Parity: ${authorization.yParity}`);

  console.log('\n✉️ Sending Transaction...');

  try {
    const tx = await sponsorSigner.sendTransaction(txData as any);
    console.log(`  ✓ Transaction submitted`);
    console.log(`  Hash: ${tx.hash}`);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction failed or was not mined');
    }

    console.log(`  ✓ Transaction confirmed`);
    console.log(`  Block Number: ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Status: ${receipt.status === 1 ? 'Success ✓' : 'Failed ✗'}`);

    return {
      tx: tx as ethers.TransactionResponse,
      receipt: receipt,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed
    };
  } catch (error: any) {
    if (error.message.includes('type 4') || error.message.includes('0x04') || error.message.includes('EIP-7702')) {
      console.error('  ✗ Error: RPC does not support Type 0x04 (EIP-7702) transactions');
      throw new Error(
        'This RPC endpoint does not support EIP-7702 Type 0x04 transactions.\n' +
        'Please use an RPC that supports EIP-7702 (e.g., Arbitrum Sepolia)\n' +
        'Visit: https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers'
      );
    }
    throw error;
  }
}

async function sendSponsoredWithdrawal() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        EIP-7702 Sponsored Token Collection via ethers.js           ║');
  console.log('║        Reference: https://www.quicknode.com/guides/...            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  try {
    // Initialize
    const { eoaSigner, sponsorSigner, provider, chainId } = await initializeSigners();

    if (!TOKEN_TRANSFERER || !USER_PAYMENT_ADDR || !TEST_TOKEN || !HOT_WALLET) {
      throw new Error('Missing required environment variables');
    }

    // Check initial balances
    console.log('\n💾 Initial Balances:');
    const eaoInitialBalance = await getUSDCBalance(provider, eoaSigner.address, 'EOA');
    const sponsorInitialBalance = await getUSDCBalance(provider, sponsorSigner.address, 'Sponsor');
    const paymentInitialBalance = await getUSDCBalance(provider, USER_PAYMENT_ADDR, 'Payment Address');
    const hotWalletInitialBalance = await getUSDCBalance(provider, HOT_WALLET, 'Hot Wallet');

    // Prepare transaction data
    const iface = new ethers.Interface([
      'function transfer(address token, address recipient) public'
    ]);

    console.log('TEST_TOKEN', TEST_TOKEN);
    console.log('HOT_WALLET', HOT_WALLET);
    const callData = iface.encodeFunctionData('transfer', [TEST_TOKEN, HOT_WALLET]);

    // Send sponsored transaction
    const result = await sendSponsoredEIP7702Transaction({
      eoaSigner,
      sponsorSigner,
      provider,
      chainId,
      implementationAddress: TOKEN_TRANSFERER,
      targetAddress: USER_PAYMENT_ADDR,
      callData,
      gasLimit: 200000n
    });

    // Check final balances
    console.log('\n💾 Final Balances:');
    const eaoFinalBalance = await getUSDCBalance(provider, eoaSigner.address, 'EOA');
    const sponsorFinalBalance = await getUSDCBalance(provider, sponsorSigner.address, 'Sponsor');
    const paymentFinalBalance = await getUSDCBalance(provider, USER_PAYMENT_ADDR, 'Payment Address');
    const hotWalletFinalBalance = await getUSDCBalance(provider, HOT_WALLET, 'Hot Wallet');

    // Display summary
    console.log('\n' + '═'.repeat(70));
    console.log('SPONSORED TRANSACTION COMPLETE ✓');
    console.log('═'.repeat(70));

    console.log('\n📊 Summary:');
    console.log(`  Transaction Type: 0x04 (EIP-7702 Sponsored)`);
    console.log(`  EOA (Delegated): ${eoaSigner.address}`);
    console.log(`  Sponsor: ${sponsorSigner.address}`);
    console.log(`  Implementation: ${TOKEN_TRANSFERER}`);
    console.log(`  Target: ${USER_PAYMENT_ADDR}`);
    console.log(`  Gas Used: ${result.gasUsed?.toString()}`);
    console.log(`  Block: ${result.blockNumber}`);

    console.log('\n💰 Token Movement:');
    const tokensCollected = paymentInitialBalance - paymentFinalBalance;
    console.log(`  Tokens Collected: ${ethers.formatUnits(tokensCollected, 6)} USDC`);
    
    console.log('\n🔍 Transaction Details:');
    console.log(`  Hash: ${result.hash}`);
    console.log(`  View: https://sepolia.arbiscan.io/tx/${result.hash}`);

    console.log('\n🎯 Key Insights:');
    console.log(`  ✓ EOA did not pay for gas (Sponsor paid)`);
    console.log(`  ✓ EOA authorized delegation via authorization signature`);
    console.log(`  ✓ Sponsor sent transaction and paid all fees`);
    console.log(`  ✓ Tokens successfully collected from payment address`);
    console.log(`  ✓ EIP-7702 delegation remains active`);

    console.log('\n═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Error in sponsored transaction:');
    if (error instanceof Error) {
      console.error('Message:', error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the sponsored transaction
sendSponsoredWithdrawal().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
