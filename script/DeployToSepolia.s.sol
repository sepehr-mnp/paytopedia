// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/TokenTransferer.sol";
import "../contracts/PaymentGateway.sol";
import "../contracts/TestERC20.sol";

/**
 * @title DeployToSepolia
 * @dev Deployment script for Arbitrum Sepolia testnet with contract verification
 *
 * Usage:
 * 1. Deploy only:
 *    forge script script/DeployToSepolia.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --private-key <YOUR_PRIVATE_KEY> --broadcast
 *
 * 2. Deploy and verify:
 *    forge script script/DeployToSepolia.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --private-key <YOUR_PRIVATE_KEY> --broadcast --verify --etherscan-api-key <YOUR_ARBISCAN_API_KEY> --verifier-url https://api-sepolia.arbiscan.io/api
 *
 * 3. Verify after deployment:
 *    forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_NAME> --chain arbitrum-sepolia --etherscan-api-key <YOUR_ARBISCAN_API_KEY> --verifier-url https://api-sepolia.arbiscan.io/api --constructor-args <ENCODED_ARGS>
 */
contract DeployToSepolia is Script {
    address public constant HOT_WALLET = 0x4aa4E01416fc957117Eb3863149c7154e88a2833; // Change to your hot wallet

    TokenTransferer public tokenTransferer;
    PaymentGateway public paymentGateway;
    TestERC20 public usdc;
    TestERC20 public usdt;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log("Deployer Address:", deployer);
        console.log("Hot Wallet Address:", HOT_WALLET);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TokenTransferer
        tokenTransferer = new TokenTransferer();
       
        // Deploy PaymentGateway
        console.log("");
        paymentGateway = new PaymentGateway(HOT_WALLET, address(tokenTransferer));
       
        // Deploy USDC Mock
        console.log("");
        usdc = new TestERC20("USD Coin", "USDC",  10000 ether);
       
        // Deploy USDT Mock
        console.log("");
        usdt = new TestERC20("Tether", "USDT",  10000 ether);
       
       
        vm.stopBroadcast();

        console.log("");
        console.log("");
        console.log("TokenTransferer  :", address(tokenTransferer));
        console.log("PaymentGateway   :", address(paymentGateway));
        console.log("USDC Token       :", address(usdc));
        console.log("USDT Token       :", address(usdt));
        console.log("Hot Wallet       :", HOT_WALLET);
        console.log("Deployer         :", deployer);
        console.log("");
        
        // Display verification commands
        console.log("=== CONTRACT VERIFICATION ===");
        console.log("To verify contracts on Etherscan, run the following commands:");
        console.log("");
        
        // TokenTransferer verification (no constructor args)
        console.log("1. Verify TokenTransferer:");
        console.log("   forge verify-contract", address(tokenTransferer), "TokenTransferer --chain arbitrum-sepolia --etherscan-api-key <YOUR_ARBISCAN_API_KEY> --verifier-url https://api-sepolia.arbiscan.io/api");
        console.log("");
        
        // PaymentGateway verification (with constructor args)
        bytes memory paymentGatewayArgs = abi.encode(HOT_WALLET, address(tokenTransferer));
        console.log("2. Verify PaymentGateway:");
        console.log("");
        
        // TestERC20 (USDC) verification (with constructor args)
        bytes memory usdcArgs = abi.encode("USD Coin", "USDC", uint256(10000 ether));
        console.log("3. Verify USDC Token:");
        console.log("");
        
        // TestERC20 (USDT) verification (with constructor args)
        bytes memory usdtArgs = abi.encode("Tether", "USDT", uint256(10000 ether));
        console.log("4. Verify USDT Token:");
        console.log("");
        
        console.log("   Etherscan links:");
        console.log("   https://sepolia.arbiscan.io/address/", address(tokenTransferer));
        console.log("   https://sepolia.arbiscan.io/address/", address(paymentGateway));
        console.log("   https://sepolia.arbiscan.io/address/", address(usdc));
        console.log("   https://sepolia.arbiscan.io/address/", address(usdt));
        console.log("");
    }
}
