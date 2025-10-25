import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TokenTransferer", function () {
  let tokenTransferer, mockToken;
  let owner, recipient, user1;

  beforeEach(async function () {
    [owner, recipient, user1] = await ethers.getSigners();

    // Deploy TokenTransferer
    const TokenTransferer = await ethers.getContractFactory("TokenTransferer");
    tokenTransferer = await TokenTransferer.deploy();
    await tokenTransferer.waitForDeployment();

    // Deploy a mock ERC20 token for testing
    const ERC20Mock = await ethers.getContractFactory("TestERC20");
    mockToken = await ERC20Mock.deploy("Test Token", "TST", ethers.parseEther("1000"));
    await mockToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const address = await tokenTransferer.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should accept ETH", async function () {
      const tx = await owner.sendTransaction({
        to: await tokenTransferer.getAddress(),
        value: ethers.parseEther("1"),
      });
      
      expect(tx).to.be.ok;
    });
  });

  describe("Single Token Transfer", function () {
    it("Should transfer all tokens to recipient", async function () {
      const amount = ethers.parseEther("100");
      
      // Send tokens to TokenTransferer
      await mockToken.transfer(await tokenTransferer.getAddress(), amount);
      
      // Verify balance
      let balance = await mockToken.balanceOf(await tokenTransferer.getAddress());
      expect(balance).to.equal(amount);

      // Call transfer function
      await tokenTransferer.transfer(await mockToken.getAddress(), recipient.address);

      // Verify tokens moved
      balance = await mockToken.balanceOf(await tokenTransferer.getAddress());
      expect(balance).to.equal(0);

      const recipientBalance = await mockToken.balanceOf(recipient.address);
      expect(recipientBalance).to.equal(amount);
    });

    it("Should reject transfer with invalid token", async function () {
      await expect(
        tokenTransferer.transfer(ethers.ZeroAddress, recipient.address)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should reject transfer to invalid recipient", async function () {
      const amount = ethers.parseEther("100");
      await mockToken.transfer(await tokenTransferer.getAddress(), amount);

      await expect(
        tokenTransferer.transfer(await mockToken.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("Should reject transfer with no balance", async function () {
      await expect(
        tokenTransferer.transfer(await mockToken.getAddress(), recipient.address)
      ).to.be.revertedWith("No tokens to transfer");
    });
  });

  describe("Multiple Token Transfer", function () {
    let mockToken2;

    beforeEach(async function () {
      // Deploy second mock token
      const ERC20Mock = await ethers.getContractFactory("TestERC20");
      mockToken2 = await ERC20Mock.deploy("Test Token 2", "TST2", ethers.parseEther("1000"));
      await mockToken2.waitForDeployment();
    });

    it("Should transfer multiple tokens", async function () {
      const amount1 = ethers.parseEther("50");
      const amount2 = ethers.parseEther("75");

      // Send tokens to TokenTransferer
      await mockToken.transfer(await tokenTransferer.getAddress(), amount1);
      await mockToken2.transfer(await tokenTransferer.getAddress(), amount2);

      // Transfer multiple
      await tokenTransferer.transferMultiple(
        [await mockToken.getAddress(), await mockToken2.getAddress()],
        recipient.address
      );

      // Verify transfers
      expect(await mockToken.balanceOf(recipient.address)).to.equal(amount1);
      expect(await mockToken2.balanceOf(recipient.address)).to.equal(amount2);
      expect(await mockToken.balanceOf(await tokenTransferer.getAddress())).to.equal(0);
      expect(await mockToken2.balanceOf(await tokenTransferer.getAddress())).to.equal(0);
    });

    it("Should transfer only non-zero balances", async function () {
      const amount1 = ethers.parseEther("50");

      // Only send first token
      await mockToken.transfer(await tokenTransferer.getAddress(), amount1);

      // Transfer multiple (second token has no balance)
      await tokenTransferer.transferMultiple(
        [await mockToken.getAddress(), await mockToken2.getAddress()],
        recipient.address
      );

      // Verify transfer
      expect(await mockToken.balanceOf(recipient.address)).to.equal(amount1);
      expect(await mockToken2.balanceOf(recipient.address)).to.equal(0);
    });

    it("Should reject empty token array", async function () {
      await expect(
        tokenTransferer.transferMultiple([], recipient.address)
      ).to.be.revertedWith("No tokens specified");
    });

    it("Should reject invalid recipient", async function () {
      await expect(
        tokenTransferer.transferMultiple(
          [await mockToken.getAddress()],
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("Should reject invalid token in array", async function () {
      const amount = ethers.parseEther("50");
      await mockToken.transfer(await tokenTransferer.getAddress(), amount);

      await expect(
        tokenTransferer.transferMultiple(
          [await mockToken.getAddress(), ethers.ZeroAddress],
          recipient.address
        )
      ).to.be.revertedWith("Invalid token address");
    });
  });
});
