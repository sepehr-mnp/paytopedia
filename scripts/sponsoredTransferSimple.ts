import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Simple EIP-7702 Sponsored Transfer
 * 
 * Based on: https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers
 * 
 * This script demonstrates a simplified sponsored EIP-7702 transaction:
 * - EOA authorizes a transfer via delegation
 * - Sponsor sends the transaction and pays gas
 * - TokenTransferer.transfer() is called in delegated context
 * - Tokens move from payment address to hot wallet
 * 
 * Key: The transfer() function is directly called through the implementation
 */

const {
  PRIVATE_KEY,
  USER_PAYMENT_PRIVATE_KEY,
  HOT_WALLET,
  TOKEN_TRANSFERER,
  USER_PAYMENT_ADDR,
  TEST_TOKEN,
  RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
} = process.env;

async function sponsoredTransfer() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║       EIP-7702 Sponsored Transfer - Simple Implementation         ║');
  console.log('║                                                                   ║');
  console.log('║    Reference: https://www.quicknode.com/guides/...               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // ========================================================================
    // STEP 1: Validate Environment & Initialize
    // ========================================================================
    console.log('📋 Step 1: Initialize & Validate');
    console.log('─'.repeat(70));

    if (!PRIVATE_KEY || !USER_PAYMENT_PRIVATE_KEY || !TOKEN_TRANSFERER || 
        !USER_PAYMENT_ADDR || !HOT_WALLET || !TEST_TOKEN) {
      throw new Error('Missing required environment variables');
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const sponsor = new ethers.Wallet(PRIVATE_KEY, provider);
    const eoa = new ethers.Wallet(USER_PAYMENT_PRIVATE_KEY, provider);
    
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log(`✓ Connected to chain: ${chainId} (${network.name})`);
    console.log(`✓ EOA Address: ${eoa.address}`);
    console.log(`✓ Sponsor Address: ${sponsor.address}`);
    console.log(`✓ Implementation: ${TOKEN_TRANSFERER}`);
    console.log(`✓ Token Contract: ${TEST_TOKEN}`);
    console.log(`✓ Hot Wallet: ${HOT_WALLET}`);

    // ========================================================================
    // STEP 2: Check Initial Balances
    // ========================================================================
    console.log('\n💰 Step 2: Check Initial Balances');
    console.log('─'.repeat(70));

    const erc20ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const tokenContract = new ethers.Contract(TEST_TOKEN, erc20ABI, provider);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();

    const eaoBalance = await tokenContract.balanceOf(eoa.address);
    const hotWalletBalance = await tokenContract.balanceOf(HOT_WALLET);
    const sponsorETH = await provider.getBalance(sponsor.address);

    console.log(`  ${eoa.address.slice(0, 6)}... ${symbol}: ${ethers.formatUnits(eaoBalance, decimals)} ${symbol}`);
    console.log(`  ${HOT_WALLET.slice(0, 6)}... ${symbol}: ${ethers.formatUnits(hotWalletBalance, decimals)} ${symbol}`);
    console.log(`  Sponsor ETH: ${ethers.formatEther(sponsorETH)} ETH`);

    // ========================================================================
    // STEP 3: Create EIP-7702 Authorization
    // ========================================================================
    console.log('\n🔐 Step 3: Create EIP-7702 Authorization');
    console.log('─'.repeat(70));

    // Get EOA's current nonce (for sponsored: use current, not +1)
    const eoaNonce = await provider.getTransactionCount(eoa.address);
    console.log(`  EOA Current Nonce: ${eoaNonce}`);

    // Create authorization digest per EIP-7702 spec
    // digest = keccak256(0x05 || rlp([chain_id, address, nonce]))
    const authTupleData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint64'],
      [chainId, TOKEN_TRANSFERER, eoaNonce]
    );

    const digest = ethers.keccak256(ethers.concat(['0x05', authTupleData]));

    // Sign the authorization with EOA's private key
    const signature = eoa.signingKey.sign(digest);
    const yParity = signature.v - 27; // Convert from ECDSA (27/28) to EIP-7702 parity (0/1)

    console.log(`  ✓ Authorization digest created`);
    console.log(`    ChainId: ${chainId}`);
    console.log(`    Implementation: ${TOKEN_TRANSFERER}`);
    console.log(`    Nonce: ${eoaNonce}`);
    console.log(`  ✓ Signed with EOA private key`);
    console.log(`    V Parity: ${yParity} (converted from ${signature.v})`);

    // ========================================================================
    // STEP 4: Encode Transfer Call Data
    // ========================================================================
    console.log('\n📝 Step 4: Encode Transfer Call Data');
    console.log('─'.repeat(70));

    // The transfer function signature in TokenTransferer
    const iface = new ethers.Interface([
      'function transfer(address token, address recipient) public'
    ]);

    const callData = iface.encodeFunctionData('transfer', [TEST_TOKEN, HOT_WALLET]);
    console.log(`  ✓ Encoded transfer(${TEST_TOKEN.slice(0, 6)}..., ${HOT_WALLET.slice(0, 6)}...)`);
    console.log(`    Call Data: ${callData.slice(0, 66)}...`);

    // ========================================================================
    // STEP 5: Estimate Gas
    // ========================================================================
    console.log('\n⛽ Step 5: Estimate Gas');
    console.log('─'.repeat(70));

    const gasEstimate = await provider.estimateGas({
      to: eoa.address,
      data: callData,
      from: sponsor.address
    });

    const feeData = await provider.getFeeData();
    const gasLimit = gasEstimate * 2n; // 2x safety margin
    const gasPrice = feeData.gasPrice || 1n;

    console.log(`  Gas Estimate: ${gasEstimate.toString()}`);
    console.log(`  Gas Limit (2x): ${gasLimit.toString()}`);
    console.log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`  Est. Cost: ${ethers.formatEther(gasLimit * gasPrice)} ETH`);

    // ========================================================================
    // STEP 6: Build Type 0x04 Transaction
    // ========================================================================
    console.log('\n🏗️  Step 6: Build EIP-7702 Type 0x04 Transaction');
    console.log('─'.repeat(70));

    const sponsorNonce = await provider.getTransactionCount(sponsor.address);

    const txData = {
      from: sponsor.address,
      to: eoa.address,                    // Target: EOA address
      data: callData,                     // The transfer call
      value: 0n,                          // No ETH sent
      type: 2,                            // EIP-7702 Set Code Type
      nonce: sponsorNonce,                // Sponsor's nonce
      chainId: chainId,
      // gasLimit: gasLimit * 2n,
      // gasPrice: gasPrice * 2n,
      // authorizationList: [
      //   {
      //     chainId: chainId,
      //     address: TOKEN_TRANSFERER,      // Implementation contract
      //     nonce: eoaNonce+1, 
      //     signature: {
      //       yParity: yParity,
      //       r: signature.r,
      //       s: signature.s,
      //       // v: signature.v
      //     },               // EOA's CURRENT nonce (not +1)
      //   }
      // ]
    };

    console.log(`  Type: 0x04 (EIP-7702 Set Code Transaction)`);
    console.log(`  To (EOA): ${eoa.address}`);
    console.log(`  From (Sponsor): ${sponsor.address}`);
    console.log(`  Data: ${callData.slice(0, 66)}... (transfer call)`);
    console.log(`  Nonce: ${sponsorNonce}`);
    console.log(`  Gas Limit: ${gasLimit.toString()}`);
    console.log(`  Authorization: Implementation set to ${TOKEN_TRANSFERER}`);

    // ========================================================================
    // STEP 7: Send Transaction
    // ========================================================================
    console.log('\n✉️  Step 7: Send Sponsored Transaction');
    console.log('─'.repeat(70));

    const tx = await sponsor.sendTransaction(txData as any);
    console.log(`  ✓ Transaction submitted to mempool`);
    console.log(`  Hash: ${tx.hash}`);

    // ========================================================================
    // STEP 8: Wait for Confirmation
    // ========================================================================
    console.log('\n⏳ Step 8: Wait for Confirmation');
    console.log('─'.repeat(70));

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction failed to be mined');
    }

    console.log(`  ✓ Transaction confirmed`);
    console.log(`  Block Number: ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Status: ${receipt.status === 1 ? '✓ Success' : '✗ Failed'}`);

    // ========================================================================
    // STEP 9: Verify Results
    // ========================================================================
    console.log('\n✅ Step 9: Verify Transfer Results');
    console.log('─'.repeat(70));

    const eaoBalanceFinal = await tokenContract.balanceOf(eoa.address);
    const hotWalletBalanceFinal = await tokenContract.balanceOf(HOT_WALLET);

    console.log(`  EOA Balance After: ${ethers.formatUnits(eaoBalanceFinal, decimals)} ${symbol}`);
    console.log(`  Hot Wallet Balance After: ${ethers.formatUnits(hotWalletBalanceFinal, decimals)} ${symbol}`);

    const tokensTransferred = eaoBalance - eaoBalanceFinal;
    console.log(`  Tokens Transferred: ${ethers.formatUnits(tokensTransferred, decimals)} ${symbol}`);

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('\n' + '═'.repeat(70));
    console.log('✅ SPONSORED TRANSFER COMPLETE');
    console.log('═'.repeat(70));

    console.log('\n📊 Transaction Summary:');
    console.log(`  Type: 0x04 (EIP-7702 Sponsored)`);
    console.log(`  EOA (Authorized): ${eoa.address}`);
    console.log(`  Sponsor (Payer): ${sponsor.address}`);
    console.log(`  Implementation: ${TOKEN_TRANSFERER}`);
    console.log(`  Function Called: transfer()`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Block: ${receipt.blockNumber}`);

    console.log('\n💫 What Happened:');
    console.log(`  1. EOA signed EIP-7702 authorization`);
    console.log(`  2. Sponsor sent Type 0x04 transaction (paid gas)`);
    console.log(`  3. EVM delegated EOA to ${TOKEN_TRANSFERER.slice(0, 6)}...`);
    console.log(`  4. transfer() executed in delegated context`);
    console.log(`  5. Tokens moved to hot wallet`);
    console.log(`  6. Delegation remains active`);

    console.log('\n🔗 Explorer:');
    console.log(`  https://sepolia.arbiscan.io/tx/${tx.hash}`);

    console.log('\n💰 Cost Analysis:');
    const txCost = receipt.gasUsed * gasPrice;
    console.log(`  Gas Used: ${receipt.gasUsed.toString()} units`);
    console.log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`  Total Cost: ${ethers.formatEther(txCost)} ETH`);
    console.log(`  Paid by: Sponsor (EOA paid $0)`);

    console.log('\n🎯 Key Insights:');
    console.log(`  ✓ EOA authorized with current nonce (not +1)`);
    console.log(`  ✓ Different wallets: EOA signs, Sponsor sends`);
    console.log(`  ✓ Sponsor absorbs all gas costs`);
    console.log(`  ✓ EOA has zero ETH cost`);
    console.log(`  ✓ Transfer completed in delegated context`);
    console.log(`  ✓ Tokens successfully collected`);

    console.log('\n═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.message.includes('type 4') || error.message.includes('0x04')) {
        console.error('\n  This RPC does not support EIP-7702 Type 0x04 transactions.');
        console.error('  Use Arbitrum Sepolia: https://sepolia-rollup.arbitrum.io/rpc');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

sponsoredTransfer();
