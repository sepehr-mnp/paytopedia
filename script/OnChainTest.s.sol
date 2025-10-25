// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/TokenTransferer.sol";
import "../contracts/PaymentGateway.sol";


/**
 * @title OnChainTest
 * @dev On-chain integration test for EIP-7702 payment gateway service
 * 
 * Environment Variables Required:
 * - PRIVATE_KEY: Service operator private key
 * - HOT_WALLET: Address to receive collected tokens
 * - PAYMENT_GATEWAY: Deployed PaymentGateway contract address
 * - TOKEN_TRANSFERER: Deployed TokenTransferer contract address
 * - USER_PAYMENT_ADDR: User's payment address (created off-chain)
 * - USER_PAYMENT_PRIVATE_KEY: Private key for the payment address
 * - TEST_TOKEN: Token contract address to test with
 * 
 * Usage:
 * forge script script/OnChainTest.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract OnChainTest is Script {
    address public hotWallet;
    address public paymentGateway;
    address public tokenTransferer;
    address public userPaymentAddr;
    uint256 public userPaymentPrivateKey;
    address public testToken;
    address public serviceOperator;

    function setUp() external {
        serviceOperator = vm.addr(vm.envUint("PRIVATE_KEY"));
        hotWallet = vm.envAddress("HOT_WALLET");
        paymentGateway = vm.envAddress("PAYMENT_GATEWAY");
        tokenTransferer = vm.envAddress("TOKEN_TRANSFERER");
        userPaymentAddr = vm.envAddress("USER_PAYMENT_ADDR");
        userPaymentPrivateKey = vm.envUint("USER_PAYMENT_PRIVATE_KEY");
        testToken = vm.envAddress("TEST_TOKEN");

        require(hotWallet != address(0), "Invalid HOT_WALLET");
        require(paymentGateway != address(0), "Invalid PAYMENT_GATEWAY");
        require(tokenTransferer != address(0), "Invalid TOKEN_TRANSFERER");
        require(userPaymentAddr != address(0), "Invalid USER_PAYMENT_ADDR");
        require(testToken != address(0), "Invalid TEST_TOKEN");
        require(userPaymentPrivateKey != 0, "Invalid USER_PAYMENT_PRIVATE_KEY");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("");
        console.log("EIP-7702 On-Chain Test");
        console.log("");

        console.log("Configuration:");
        console.log("  Service Operator    :", serviceOperator);
        console.log("  Hot Wallet          :", hotWallet);
        console.log("  Token Transferer    :", tokenTransferer);
        console.log("  User Payment Addr   :", userPaymentAddr);
        console.log("  Test Token          :", testToken);
        console.log("");

        uint256 initialUserPaymentBalance = IERC20(testToken).balanceOf(userPaymentAddr);
        uint256 initialHotWalletBalance = IERC20(testToken).balanceOf(hotWallet);

        console.log("Initial State:");
        console.log("  Payment Address Balance:", initialUserPaymentBalance);
        console.log("  Hot Wallet Balance     :", initialHotWalletBalance);
        
        console.log( block.chainid);

        console.log("Creating EIP-7702 Delegation:");
        
        vm.startBroadcast(deployerPrivateKey);

        // Compute the digest for delegation signing
        // Hash: keccak256(abi.encode(chainId, nonce, implementation))
        // bytes32 digest = keccak256(abi.encode(block.chainid, uint64(1), tokenTransferer));

        // Sign the digest manually using vm.sign()
        // Reference: https://getfoundry.sh/reference/cheatcodes/sign
        // (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPaymentPrivateKey, digest);

        // Convert v from standard ECDSA (27/28) to EIP-7702 parity format (0/1)
        // vm.sign() returns v as 27 or 28, but EIP-7702 requires 0 or 1
        // uint8 v_parity = v - 27;

        // Manually construct SignedDelegation struct with nonce = 0
        // VmSafe.SignedDelegation memory auth = VmSafe.SignedDelegation({
        //     v: v_parity,  // Use converted parity (0 or 1)
        //     r: r,
        //     s: s,
        //     nonce: 1,  // Hardcoded to 0 as requested
        //     implementation: tokenTransferer
        // });

        VmSafe.SignedDelegation memory auth = vm.signDelegation(tokenTransferer, userPaymentPrivateKey);

        console.log("    Implementation :", auth.implementation);
        console.log("    Nonce          :", auth.nonce);
        console.log("");

        console.log("Attaching delegation and collecting tokens:");

        // Attach the delegation
        vm.attachDelegation(auth);

        // Call transfer on delegated address
        TokenTransferer(payable(userPaymentAddr)).transfer(testToken, hotWallet);
        

        vm.stopBroadcast();

        console.log("");
        console.log("Verifying Results:");

        uint256 finalUserPaymentBalance = IERC20(testToken).balanceOf(userPaymentAddr);
        uint256 finalHotWalletBalance = IERC20(testToken).balanceOf(hotWallet);

        console.log("  Final Payment Address Balance:", finalUserPaymentBalance);
        console.log("  Final Hot Wallet Balance     :", finalHotWalletBalance);
        console.log("  Tokens Collected             :", finalHotWalletBalance - initialHotWalletBalance);
        console.log("");

        if (finalUserPaymentBalance == 0 && finalHotWalletBalance > initialHotWalletBalance) {
            console.log(" Test passed - tokens collected successfully");
        } else {
            console.log("Test failed - collection did not complete");
        }
    }
}
