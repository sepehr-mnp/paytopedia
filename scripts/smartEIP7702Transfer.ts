import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Smart EIP-7702 Delegation Transfer
 * 
 * Based on: https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-transactions-with-ethers
 * 
 * This script intelligently handles EIP-7702 delegation:
 * 
 * If EOA has NO code delegation:
 *   ├─ Create EIP-7702 authorization using eoa.authorize()
 *   ├─ Sign delegation digest
 *   ├─ Build Type 0x04 transaction
 *   ├─ Include authorization list
 *   └─ Establish delegation
 * 
 * If EOA already HAS code delegation:
 *   ├─ Check if it's the correct implementation
 *   ├─ Skip authorization creation
 *   └─ Just call transfer() directly (delegation already active)
 * 
 * This is a sponsored transaction in both cases:
 *   - EOA signs authorization (if needed)
 *   - Sponsor sends and pays gas
 */

const {
  PRIVATE_KEY,
  USER_PAYMENT_PRIVATE_KEY,
  HOT_WALLET,
  TOKEN_TRANSFERER,
  USER_PAYMENT_ADDR,
  TEST_TOKEN,
  RPC_URL
} = process.env;

interface DelegationStatus {
  hasCode: boolean;
  codeAddress: string | null;
  isCorrectImpl: boolean;
}

async function checkDelegationStatus(
  provider: ethers.JsonRpcProvider,
  eoa: ethers.Wallet
): Promise<DelegationStatus> {
  console.log('\n🔍 Step 2: Check EOA Delegation Status');
  console.log('─'.repeat(70));

  try {
    // Get code at EOA address
    const code = await provider.getCode(eoa.address);
    console.log('code', code);
    if (code === '0x') {
      console.log(`  ✓ EOA has NO code delegation`);
      console.log(`    Address: ${eoa.address}`);
      console.log(`    Code: None`);
      return {
        hasCode: false,
        codeAddress: null,
        isCorrectImpl: false
      };
    }

    // Code exists, parse it
    console.log(`  ✓ EOA has code delegation!`);
    console.log(`    Address: ${eoa.address}`);
    console.log(`    Code: ${code.slice(0, 66)}...`);

    // EIP-7702 delegation format: 0xef0100 + contract_address (20 bytes)
    // Total: 3 bytes prefix + 20 bytes address = 23 bytes (46 hex chars + 0x)
    if (code.length === 48 && code.startsWith('0xef0100')) {
      // Extract the delegated address
      const delegatedAddr = '0x' + code.slice(8); // Skip '0xef0100'
      console.log(`    Delegated to: ${delegatedAddr}`);

      const isCorrect = delegatedAddr.toLowerCase() === TOKEN_TRANSFERER.toLowerCase();
      console.log(`    Correct implementation: ${isCorrect ? '✓' : '✗'}`);

      return {
        hasCode: true,
        codeAddress: delegatedAddr,
        isCorrectImpl: isCorrect
      };
    }

    console.log(`    ⚠️  Code present but not EIP-7702 format`);
    return {
      hasCode: true,
      codeAddress: null,
      isCorrectImpl: false
    };
  } catch (error) {
    console.error('  Error checking delegation:', error);
    throw error;
  }
}

async function createAuthorization(firstSigner: ethers.Wallet, targetAddress: string, nonce: number) {
  const auth = await firstSigner.authorize({
    address: targetAddress,
    nonce: nonce,
    chainId: 11155111, // Sepolia chain ID
  });

  console.log("Authorization created with nonce:", auth.nonce);
  return auth;
}

async function createAuthorizationWithEOAAuthorize(config: {
  eoa: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  chainId: number;
  implementationAddress: string;
}) {
  console.log('\n🔐 Step 3: Create EIP-7702 Authorization (using eoa.authorize)');
  console.log('─'.repeat(70));

  const { eoa, provider, chainId, implementationAddress } = config;

  // Get EOA's current nonce (for sponsored: use current, not +1)
  const eoaNonce = await provider.getTransactionCount(eoa.address);
  console.log(`  EOA Current Nonce: ${eoaNonce}`);

  // Create authorization using ethers.js authorize method
  // Per EIP-7702: keccak256(0x05 || rlp([chain_id, address, nonce]))
  const authTupleData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'uint64'],
    [chainId, implementationAddress, eoaNonce]
  );

  const digest = ethers.keccak256(ethers.concat(['0x05', authTupleData]));

  console.log(`  Digest created for authorization`);
  console.log(`    ChainId: ${chainId}`);
  console.log(`    Implementation: ${implementationAddress}`);
  console.log(`    Nonce: ${eoaNonce}`);

  // Sign the authorization with EOA's private key
  const signature = eoa.signingKey.sign(digest);
  const yParity = signature.v - 27; // Convert from ECDSA (27/28) to EIP-7702 parity (0/1)

  console.log(`  ✓ Authorization signed by EOA`);
  console.log(`    Signature V (parity): ${yParity}`);

  return {
    chainId,
    address: implementationAddress,
    nonce: eoaNonce,
    yParity: yParity as 0 | 1,
    r: signature.r,
    s: signature.s
  };
}

async function sendTransferTransaction(config: {
  sponsor: ethers.Wallet;
  eoa: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  chainId: number;
  tokenTransferer: string;
  tokenAddress: string;
  hotWallet: string;
  authorization?: {
    chainId: number;
    address: string;
    nonce: number;
    signature: {
      yParity: 0 | 1;
      r: string;
      s: string;
      // v: number;
    };
  };
  hasDelegation: boolean;
}) {
  console.log('\n📤 Step 4: Send Transfer Transaction');
  console.log('─'.repeat(70));

  const {
    sponsor,
    eoa,
    provider,
    chainId,
    tokenTransferer,
    tokenAddress,
    hotWallet,
    authorization,
    hasDelegation
  } = config;

  // Prepare transfer call data
  const iface = new ethers.Interface([
    'function transfer(address token, address recipient) public'
  ]);

  const callData = iface.encodeFunctionData('transfer', [tokenAddress, hotWallet]);

  console.log(`\n📋 Building Transaction`);
  console.log('─'.repeat(70));

  // Get gas estimate
  const gasEstimate = await provider.estimateGas({
    to: eoa.address,
    data: callData,
    from: sponsor.address
  });

  const feeData = await provider.getFeeData();
  const gasLimit = gasEstimate * 2n;
  const gasPrice = feeData.gasPrice || 1n;

  console.log(`  Gas Estimate: ${gasEstimate.toString()}`);
  console.log(`  Gas Limit (2x): ${gasLimit.toString()}`);
  console.log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  console.log(`  Est. Cost: ${ethers.formatEther(gasLimit * gasPrice)} ETH`);

  // Build transaction
  const sponsorNonce = await provider.getTransactionCount(sponsor.address);

  let txData: any = {
    to: eoa.address,
    data: callData,
    value: 0n,
    type: 4, // EIP-7702 Set Code Transaction
    nonce: sponsorNonce,
    chainId: chainId,
    gasLimit: gasLimit,
    gasPrice: gasPrice
  };

  // Only include authorization if delegation doesn't exist
  if (!hasDelegation && authorization) {
    txData.authorizationList = [
      {
        chainId: authorization.chainId,
        address: authorization.address,
        nonce: authorization.nonce,
        signature: {
          yParity: authorization.signature.yParity,
          r: authorization.signature.r,
          s: authorization.signature.s,
          // v: authorization.v
        }
      }
    ];
    console.log(`\n📍 Transaction includes NEW EIP-7702 authorization`);
  } else if (hasDelegation) {
    console.log(`\n📍 Transaction uses EXISTING delegation (no authorization needed)`);
    txData.authorizationList = [];
  }

  console.log(`\n📦 Transaction Structure:`);
  console.log(`  Type: 0x04 (EIP-7702 Set Code Transaction)`);
  console.log(`  To (EOA): ${eoa.address}`);
  console.log(`  From (Sponsor): ${sponsor.address}`);
  console.log(`  Data: ${callData.slice(0, 66)}... (transfer call)`);
  console.log(`  Nonce: ${sponsorNonce}`);
  console.log(`  Gas Limit: ${gasLimit.toString()}`);
  console.log(`  Authorization List: ${txData.authorizationList?.length || 0} items`);

  console.log('\n✉️  Sending Transaction...');

  try {
    const tx = await sponsor.sendTransaction(txData);
    console.log(`  ✓ Transaction submitted to mempool`);
    console.log(`  Hash: ${tx.hash}`);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction failed to be mined');
    }

    console.log(`  ✓ Transaction confirmed`);
    console.log(`  Block Number: ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Status: ${receipt.status === 1 ? '✓ Success' : '✗ Failed'}`);

    return {
      tx,
      receipt,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed
    };
  } catch (error: any) {
    if (error.message.includes('type 4') || error.message.includes('0x04')) {
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

async function smartEIP7702Transfer() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║          Smart EIP-7702 Delegation Transfer (Adaptive)                   ║');
  console.log('║                                                                           ║');
  console.log('║   • Check if EOA has delegation                                          ║');
  console.log('║   • If NO: Create authorization + establish delegation                   ║');
  console.log('║   • If YES: Use existing delegation directly                             ║');
  console.log('║   • Sponsor sends & pays gas in both cases                               ║');
  console.log('║                                                                           ║');
  console.log('║   Reference: https://www.quicknode.com/guides/...                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // ========================================================================
    // STEP 1: Initialize & Validate
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

    // ========================================================================
    // STEP 2: Check Delegation Status
    // ========================================================================
    const delegationStatus = await checkDelegationStatus(provider, eoa);

    // ========================================================================
    // STEP 3: Create Authorization if needed
    // ========================================================================
    let authorization: any = null;

    if (!delegationStatus.hasCode) {
      console.log('Creating new authorization to establish delegation...');
      authorization = await createAuthorization(eoa, TOKEN_TRANSFERER, 0);
      // await createAuthorizationWithEOAAuthorize({
      //   eoa,
      //   provider,
      //   chainId,
      //   implementationAddress: TOKEN_TRANSFERER
      // });
    } else if (!delegationStatus.isCorrectImpl) {
      console.log('\n⚠️  EOA has delegation to different implementation!');
      console.log(`    Current: ${delegationStatus.codeAddress}`);
      console.log(`    Expected: ${TOKEN_TRANSFERER}`);
      console.log('    Creating new authorization to update delegation...');

      authorization = await createAuthorizationWithEOAAuthorize({
        eoa,
        provider,
        chainId,
        implementationAddress: TOKEN_TRANSFERER
      });
    } else {
      console.log('\n✓ EOA already delegated to correct implementation');
      console.log('  No new authorization needed');
    }


    // ========================================================================
    // STEP 4: Send Transfer Transaction
    // ========================================================================
    // const result = await sendTransferTransaction({
    //   sponsor,
    //   eoa,
    //   provider,
    //   chainId,
    //   tokenTransferer: TOKEN_TRANSFERER,
    //   tokenAddress: TEST_TOKEN,
    //   hotWallet: HOT_WALLET,
    //   authorization,
    //   hasDelegation: delegationStatus.hasCode && delegationStatus.isCorrectImpl
    // });
    const iface = new ethers.Interface([
      'function transfer(address token, address recipient) public'
    ]);


    const result = await sponsor.sendTransaction({
      to: eoa.address,
      data: iface.encodeFunctionData('transfer', [TEST_TOKEN, HOT_WALLET]),
      value: 0n,
      type: 4, // EIP-7702 Set Code Transaction
      // nonce: sponsorNonce,
      chainId: chainId,
      authorizationList: [authorization]
    });

    // ========================================================================
    // STEP 5: Verify Results
    // ========================================================================
    console.log('\n✅ Step 5: Verify Transfer Results');
    console.log('─'.repeat(70));

    const erc20ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const tokenContract = new ethers.Contract(TEST_TOKEN, erc20ABI, provider);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();

    const eaoBalanceFinal = await tokenContract.balanceOf(eoa.address);
    const hotWalletBalanceFinal = await tokenContract.balanceOf(HOT_WALLET);

    console.log(`  EOA Balance After: ${ethers.formatUnits(eaoBalanceFinal, decimals)} ${symbol}`);
    console.log(`  Hot Wallet Balance After: ${ethers.formatUnits(hotWalletBalanceFinal, decimals)} ${symbol}`);

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('\n' + '═'.repeat(75));
    console.log('✅ SMART EIP-7702 TRANSFER COMPLETE');
    console.log('═'.repeat(75));

    console.log('\n📊 Transaction Summary:');
    console.log(`  Type: 0x04 (EIP-7702 Sponsored)`);
    console.log(`  EOA (Delegated): ${eoa.address}`);
    console.log(`  Sponsor (Payer): ${sponsor.address}`);
    console.log(`  Implementation: ${TOKEN_TRANSFERER}`);
    console.log(`  Gas Used: ${result.gasUsed?.toString()}`);
    console.log(`  Block: ${result.blockNumber}`);

    console.log('\n🔗 Delegation Status:');
    if (!delegationStatus.hasCode) {
      console.log(`  ✓ NEW delegation established`);
      console.log(`  ✓ Authorization created and signed`);
    } else if (delegationStatus.isCorrectImpl) {
      console.log(`  ✓ EXISTING delegation reused`);
      console.log(`  ✓ No new authorization needed`);
    } else {
      console.log(`  ✓ Delegation UPDATED`);
      console.log(`  ✓ Old: ${delegationStatus.codeAddress}`);
      console.log(`  ✓ New: ${TOKEN_TRANSFERER}`);
    }

    console.log('\n🎯 What Happened:');
    if (!delegationStatus.hasCode) {
      console.log(`  1. EOA had NO code delegation`);
      console.log(`  2. Created EIP-7702 authorization digest`);
      console.log(`  3. Signed with EOA's private key`);
      console.log(`  4. Sponsor sent Type 0x04 transaction`);
      console.log(`  5. EVM established delegation`);
      console.log(`  6. transfer() executed in delegated context`);
      console.log(`  7. Tokens moved to hot wallet`);
    } else {
      console.log(`  1. EOA already had delegation`);
      console.log(`  2. Sponsor sent Type 0x04 transaction`);
      console.log(`  3. Reused existing delegation`);
      console.log(`  4. transfer() executed in delegated context`);
      console.log(`  5. Tokens moved to hot wallet`);
    }

    console.log('\n🔗 Explorer:');
    console.log(`  https://sepolia.arbiscan.io/tx/${result.hash}`);

    console.log('\n═'.repeat(75));

  } catch (error) {
    console.error('\n❌ Error:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

smartEIP7702Transfer();
