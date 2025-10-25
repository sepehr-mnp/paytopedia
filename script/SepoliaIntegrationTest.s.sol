// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/TokenTransferer.sol";
import "../contracts/TestERC20.sol";

/**
 * @title SepoliaIntegrationTest
 * @dev Integration test script for Sepolia testnet
 * Demonstrates real EIP-7702 token collection
 *
 * Prerequisites:
 * 1. Deploy contracts first: forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key <PK> --broadcast
 * 2. Update contract addresses below
 * 3. Fund test users with ETH and tokens
 *
 * Usage:
 * forge script script/SepoliaIntegrationTest.s.sol --rpc-url https://rpc.sepolia.org --private-key <YOUR_PRIVATE_KEY> --broadcast
 */
contract SepoliaIntegrationTest is Script {
    // ⚠️ UPDATE THESE WITH YOUR DEPLOYED ADDRESSES ⚠️
    TokenTransferer public constant TOKEN_TRANSFERER =
        TokenTransferer(0x9fE46736679d2D94F5054b1165DaC7D4d91D5591); // Change this!
    TestERC20 public constant USDC = TestERC20(0x5FbDB2315678afecb367f032d93F642f64180aa3); // Change this!
    TestERC20 public constant USDT = TestERC20(0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512); // Change this!

    address public constant HOT_WALLET = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Change this!

    // Test user private keys (⚠️ These are examples - use real test wallets!)
    uint256 public constant USER1_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 public constant USER2_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address user1Addr = vm.addr(USER1_PK);
        address user2Addr = vm.addr(USER2_PK);

        console.log("╔══════════════════════════════════════════════════════════╗");
        console.log("║     🧪 SEPOLIA INTEGRATION TEST - EIP-7702 🧪           ║");
        console.log("╚══════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("📋 TEST CONFIGURATION:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Deployer       :", deployer);
        console.log("User1          :", user1Addr);
        console.log("User2          :", user2Addr);
        console.log("Hot Wallet     :", HOT_WALLET);
        console.log("TokenTransferer:", address(TOKEN_TRANSFERER));
        console.log("USDC           :", address(USDC));
        console.log("USDT           :", address(USDT));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("");

        // ========== TEST 1: Check Initial Balances ==========
        console.log("📊 TEST 1: Initial Balances");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        uint256 user1USDCBefore = USDC.balanceOf(user1Addr);
        uint256 user1USDTBefore = USDT.balanceOf(user1Addr);
        uint256 user2USDCBefore = USDC.balanceOf(user2Addr);
        uint256 hotWalletUSDCBefore = USDC.balanceOf(HOT_WALLET);

        console.log("User1 USDC Balance:", user1USDCBefore / 1e18, "tokens");
        console.log("User1 USDT Balance:", user1USDTBefore / 1e18, "tokens");
        console.log("User2 USDC Balance:", user2USDCBefore / 1e18, "tokens");
        console.log("Hot Wallet USDC Before:", hotWalletUSDCBefore / 1e18, "tokens");

        // ========== TEST 2: Transfer tokens to payment addresses ==========
        console.log("");
        console.log("💰 TEST 2: Users Send Tokens to Payment Addresses");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        uint256 user1SendAmount = 50 ether;
        uint256 user2SendAmount = 30 ether;

        vm.startBroadcast(USER1_PK);
        console.log("User1 transferring", user1SendAmount / 1e18, "USDC to payment address...");
        USDC.transfer(user1Addr, user1SendAmount); // Self-transfer for demo
        console.log("✅ User1 transfer complete");
        vm.stopBroadcast();

        vm.startBroadcast(USER2_PK);
        console.log("User2 transferring", user2SendAmount / 1e18, "USDC to payment address...");
        USDC.transfer(user2Addr, user2SendAmount); // Self-transfer for demo
        console.log("✅ User2 transfer complete");
        vm.stopBroadcast();

        // ========== TEST 3: Create EIP-7702 Authorizations ==========
        console.log("");
        console.log("🔐 TEST 3: Create EIP-7702 Authorizations");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        vm.startBroadcast(deployerPrivateKey);

        // Create authorizations
        Vm.SignedDelegation memory auth1 = vm.signDelegation(address(TOKEN_TRANSFERER), USER1_PK);
        Vm.SignedDelegation memory auth2 = vm.signDelegation(address(TOKEN_TRANSFERER), USER2_PK);

        console.log("✅ Authorization 1 created for User1");
        console.log("   Nonce:", auth1.nonce);
        console.log("   Implementation:", auth1.implementation);

        console.log("✅ Authorization 2 created for User2");
        console.log("   Nonce:", auth2.nonce);
        console.log("   Implementation:", auth2.implementation);

        // ========== TEST 4: Collect tokens with EIP-7702 ==========
        console.log("");
        console.log("🚀 TEST 4: Collect Tokens with EIP-7702 Delegation");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Collect from User1
        console.log("Collecting from User1...");
        vm.attachDelegation(auth1);
        TOKEN_TRANSFERER.transfer(address(USDC), HOT_WALLET);
        console.log("✅ User1 tokens collected via EIP-7702");

        // Collect from User2
        console.log("Collecting from User2...");
        vm.attachDelegation(auth2);
        TOKEN_TRANSFERER.transfer(address(USDC), HOT_WALLET);
        console.log("✅ User2 tokens collected via EIP-7702");

        vm.stopBroadcast();

        // ========== TEST 5: Verify Final Balances ==========
        console.log("");
        console.log("📊 TEST 5: Final Balances & Verification");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        uint256 user1USDCAfter = USDC.balanceOf(user1Addr);
        uint256 user2USDCAfter = USDC.balanceOf(user2Addr);
        uint256 hotWalletUSDCAfter = USDC.balanceOf(HOT_WALLET);

        console.log("");
        console.log("User1 USDC:");
        console.log("  Before:", user1USDCBefore / 1e18, "tokens");
        console.log("  After :", user1USDCAfter / 1e18, "tokens");
        console.log("  Collected:", (user1USDCBefore - user1USDCAfter) / 1e18, "tokens");

        console.log("");
        console.log("User2 USDC:");
        console.log("  Before:", user2USDCBefore / 1e18, "tokens");
        console.log("  After :", user2USDCAfter / 1e18, "tokens");
        console.log("  Collected:", (user2USDCBefore - user2USDCAfter) / 1e18, "tokens");

        console.log("");
        console.log("Hot Wallet USDC:");
        console.log("  Before:", hotWalletUSDCBefore / 1e18, "tokens");
        console.log("  After :", hotWalletUSDCAfter / 1e18, "tokens");
        console.log("  Received:", (hotWalletUSDCAfter - hotWalletUSDCBefore) / 1e18, "tokens");

        // ========== RESULTS ==========
        console.log("");
        console.log("╔══════════════════════════════════════════════════════════╗");
        console.log("║                  ✅ TEST COMPLETE ✅                     ║");
        console.log("╚══════════════════════════════════════════════════════════╝");
        console.log("");

        bool test1Passed = user1USDCAfter == 0 && user2USDCAfter == 0;
        bool test2Passed = hotWalletUSDCAfter >= (hotWalletUSDCBefore + user1SendAmount + user2SendAmount);

        if (test1Passed && test2Passed) {
            console.log("✅ ALL TESTS PASSED!");
            console.log("");
            console.log("Real EIP-7702 delegation worked successfully on Sepolia!");
            console.log("Tokens were collected from payment addresses to hot wallet.");
        } else {
            console.log("❌ SOME TESTS FAILED");
            if (!test1Passed) console.log("  - Payment addresses not fully emptied");
            if (!test2Passed) console.log("  - Hot wallet didn't receive all tokens");
        }

        console.log("");
        console.log("🔗 View Transactions on Sepolia Etherscan:");
        console.log("   https://sepolia.etherscan.io/");
    }
}
