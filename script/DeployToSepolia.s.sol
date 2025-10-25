// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/TokenTransferer.sol";
import "../contracts/PaymentGateway.sol";
import "../contracts/TestERC20.sol";

/**
 * @title DeployToSepolia
 * @dev Deployment script for Sepolia testnet
 *
 * Usage:
 * forge script script/DeployToSepolia.s.sol --rpc-url https://rpc.sepolia.org --private-key <YOUR_PRIVATE_KEY> --broadcast
 */
contract DeployToSepolia is Script {
    address public constant HOT_WALLET = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Change to your hot wallet

    TokenTransferer public tokenTransferer;
    PaymentGateway public paymentGateway;
    TestERC20 public usdc;
    TestERC20 public usdt;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("╔══════════════════════════════════════════════════════════╗");
        console.log("║         🚀 DEPLOYING TO SEPOLIA TESTNET 🚀              ║");
        console.log("╚══════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("Deployer Address:", deployer);
        console.log("Hot Wallet Address:", HOT_WALLET);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TokenTransferer
        console.log("1️⃣  Deploying TokenTransferer...");
        tokenTransferer = new TokenTransferer();
        console.log("   ✅ TokenTransferer deployed at:", address(tokenTransferer));

        // Deploy PaymentGateway
        console.log("");
        console.log("2️⃣  Deploying PaymentGateway...");
        paymentGateway = new PaymentGateway(HOT_WALLET, address(tokenTransferer));
        console.log("   ✅ PaymentGateway deployed at:", address(paymentGateway));

        // Deploy USDC Mock
        console.log("");
        console.log("3️⃣  Deploying Test USDC Token...");
        usdc = new TestERC20("USD Coin", "USDC");
        console.log("   ✅ USDC deployed at:", address(usdc));

        // Deploy USDT Mock
        console.log("");
        console.log("4️⃣  Deploying Test USDT Token...");
        usdt = new TestERC20("Tether", "USDT");
        console.log("   ✅ USDT deployed at:", address(usdt));

        // Mint test tokens for testing
        console.log("");
        console.log("5️⃣  Minting Test Tokens...");
        usdc.mint(deployer, 10000 ether);
        usdt.mint(deployer, 10000 ether);
        console.log("   ✅ Minted 10000 USDC and 10000 USDT to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("╔══════════════════════════════════════════════════════════╗");
        console.log("║              ✅ DEPLOYMENT COMPLETE ✅                   ║");
        console.log("╚══════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("📋 DEPLOYMENT SUMMARY:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("TokenTransferer  :", address(tokenTransferer));
        console.log("PaymentGateway   :", address(paymentGateway));
        console.log("USDC Token       :", address(usdc));
        console.log("USDT Token       :", address(usdt));
        console.log("Hot Wallet       :", HOT_WALLET);
        console.log("Deployer         :", deployer);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("");
        console.log("💾 Save these addresses for integration tests!");
        console.log("");
        console.log("🔗 View on Sepolia Etherscan:");
        console.log("   https://sepolia.etherscan.io/address/", address(tokenTransferer));
        console.log("");
    }
}
