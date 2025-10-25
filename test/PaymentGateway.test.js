import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("PaymentGateway", function () {
  let paymentGateway, tokenTransferer;
  let owner, hotWallet, user1, user2;

  beforeEach(async function () {
    [owner, hotWallet, user1, user2] = await ethers.getSigners();

    // Deploy TokenTransferer
    const TokenTransferer = await ethers.getContractFactory("TokenTransferer");
    tokenTransferer = await TokenTransferer.deploy();
    await tokenTransferer.waitForDeployment();

    // Deploy PaymentGateway
    const PaymentGateway = await ethers.getContractFactory("PaymentGateway");
    paymentGateway = await PaymentGateway.deploy(
      hotWallet.address,
      await tokenTransferer.getAddress()
    );
    await paymentGateway.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await paymentGateway.owner()).to.equal(owner.address);
    });

    it("Should set the correct hot wallet", async function () {
      expect(await paymentGateway.hotWallet()).to.equal(hotWallet.address);
    });

    it("Should set the correct token transferer implementation", async function () {
      expect(await paymentGateway.tokenTransfererImpl()).to.equal(
        await tokenTransferer.getAddress()
      );
    });
  });

  describe("Register Payment Address", function () {
    it("Should register a payment address for a user", async function () {
      const userId = "user123";
      const paymentAddress = user1.address;

      const tx = await paymentGateway.registerPaymentAddress(userId, paymentAddress);
      
      // Check event
      expect(tx).to.emit(paymentGateway, "PaymentAddressCreated");

      // Verify mapping
      expect(await paymentGateway.addressToUserId(paymentAddress)).to.equal(userId);
    });

    it("Should register multiple addresses for a user", async function () {
      const userId = "user456";
      
      await paymentGateway.registerPaymentAddress(userId, user1.address);
      await paymentGateway.registerPaymentAddress(userId, user2.address);

      const addresses = await paymentGateway.getUserAddresses(userId);
      expect(addresses.length).to.equal(2);
      expect(addresses[0]).to.equal(user1.address);
      expect(addresses[1]).to.equal(user2.address);
    });

    it("Should reject invalid payment address", async function () {
      const userId = "user789";
      
      await expect(
        paymentGateway.registerPaymentAddress(userId, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid payment address");
    });

    it("Should reject invalid user ID", async function () {
      await expect(
        paymentGateway.registerPaymentAddress("", user1.address)
      ).to.be.revertedWith("Invalid user ID");
    });

    it("Should only allow owner to register", async function () {
      const userId = "user999";
      
      await expect(
        paymentGateway.connect(user1).registerPaymentAddress(userId, user1.address)
      ).to.be.revertedWith("Only owner can call this");
    });
  });

  describe("Get User Addresses", function () {
    it("Should return empty array for unknown user", async function () {
      const addresses = await paymentGateway.getUserAddresses("unknown");
      expect(addresses.length).to.equal(0);
    });

    it("Should return all addresses for a user", async function () {
      const userId = "user_addresses";
      const addresses = [user1.address, user2.address];

      for (const addr of addresses) {
        await paymentGateway.registerPaymentAddress(userId, addr);
      }

      const result = await paymentGateway.getUserAddresses(userId);
      expect(result).to.deep.equal(addresses);
    });
  });

  describe("Update Hot Wallet", function () {
    it("Should update hot wallet", async function () {
      const newHotWallet = user1.address;
      
      await paymentGateway.setHotWallet(newHotWallet);
      expect(await paymentGateway.hotWallet()).to.equal(newHotWallet);
    });

    it("Should emit event on hot wallet update", async function () {
      const newHotWallet = user1.address;
      
      await expect(paymentGateway.setHotWallet(newHotWallet))
        .to.emit(paymentGateway, "HotWalletUpdated")
        .withArgs(newHotWallet);
    });

    it("Should reject invalid hot wallet", async function () {
      await expect(
        paymentGateway.setHotWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid hot wallet");
    });

    it("Should only allow owner to update", async function () {
      await expect(
        paymentGateway.connect(user1).setHotWallet(user2.address)
      ).to.be.revertedWith("Only owner can call this");
    });
  });

  describe("Update Token Transferer", function () {
    it("Should update token transferer implementation", async function () {
      const newImpl = user1.address;
      
      await paymentGateway.setTokenTransfererImpl(newImpl);
      expect(await paymentGateway.tokenTransfererImpl()).to.equal(newImpl);
    });

    it("Should emit event on token transferer update", async function () {
      const newImpl = user1.address;
      
      await expect(paymentGateway.setTokenTransfererImpl(newImpl))
        .to.emit(paymentGateway, "TokenTransfererUpdated")
        .withArgs(newImpl);
    });

    it("Should reject invalid implementation", async function () {
      await expect(
        paymentGateway.setTokenTransfererImpl(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid implementation");
    });

    it("Should only allow owner to update", async function () {
      await expect(
        paymentGateway.connect(user1).setTokenTransfererImpl(user2.address)
      ).to.be.revertedWith("Only owner can call this");
    });
  });

  describe("Transfer Ownership", function () {
    it("Should transfer ownership", async function () {
      const newOwner = user1.address;
      
      await paymentGateway.transferOwnership(newOwner);
      expect(await paymentGateway.owner()).to.equal(newOwner);
    });

    it("Should reject invalid new owner", async function () {
      await expect(
        paymentGateway.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });

    it("Should only allow owner to transfer", async function () {
      await expect(
        paymentGateway.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWith("Only owner can call this");
    });
  });
});
