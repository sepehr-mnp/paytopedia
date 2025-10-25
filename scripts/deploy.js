import hreDefault from "hardhat";
import fs from "fs";
const hre = hreDefault;
const ethers = hre.ethers;

async function main() {
  console.log("Deploying EIP-7702 Payment Gateway...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy TokenTransferer contract
  console.log("\n1. Deploying TokenTransferer contract...");
  const TokenTransferer = await ethers.getContractFactory("TokenTransferer");
  const tokenTransferer = await TokenTransferer.deploy();
  await tokenTransferer.waitForDeployment();
  const tokenTransfererAddress = await tokenTransferer.getAddress();
  console.log("TokenTransferer deployed to:", tokenTransfererAddress);

  // Deploy PaymentGateway contract
  console.log("\n2. Deploying PaymentGateway contract...");
  const hotWallet = deployer.address; // For testing, use deployer as hot wallet
  const PaymentGateway = await ethers.getContractFactory("PaymentGateway");
  const paymentGateway = await PaymentGateway.deploy(hotWallet, tokenTransfererAddress);
  await paymentGateway.waitForDeployment();
  const paymentGatewayAddress = await paymentGateway.getAddress();
  console.log("PaymentGateway deployed to:", paymentGatewayAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("TokenTransferer:", tokenTransfererAddress);
  console.log("PaymentGateway:", paymentGatewayAddress);
  console.log("Hot Wallet:", hotWallet);

  // Save deployment details
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer.address,
    tokenTransferer: tokenTransfererAddress,
    paymentGateway: paymentGatewayAddress,
    hotWallet: hotWallet,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("\nDeployment details saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
