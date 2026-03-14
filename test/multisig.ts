import { expect } from "chai";
import { ethers } from "hardhat";
import { MultiSig } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther, ZeroAddress } from "ethers";

describe("MultiSig Wallet", function () {
  let multiSig: MultiSig;
  let owner1: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  let stranger: SignerWithAddress;

  const REQUIRED_SIGNERS: bigint = 2n;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner, stranger] = await ethers.getSigners();

    const MultiSigFactory = await ethers.getContractFactory("MultiSig");
    multiSig = await MultiSigFactory.deploy(
      [owner1.address, owner2.address, owner3.address],
      REQUIRED_SIGNERS
    );
    await multiSig.waitForDeployment();
  });

  // ============ DEPLOYMENT TESTS ============
  describe("Deployment", function () {
    it("Should set the correct owners", async function () {
      expect(await multiSig.isOwner(owner1.address)).to.be.true;
      expect(await multiSig.isOwner(owner2.address)).to.be.true;
      expect(await multiSig.isOwner(owner3.address)).to.be.true;
      expect(await multiSig.isOwner(nonOwner.address)).to.be.false;
    });

    it("Should set requiredNumberOfSigners correctly", async function () {
      expect(await multiSig.requiredNumberOfSigners()).to.equal(REQUIRED_SIGNERS);
    });

    it("Should return owners via public array", async function () {
      expect(await multiSig.owners(0)).to.equal(owner1.address);
      expect(await multiSig.owners(1)).to.equal(owner2.address);
      expect(await multiSig.owners(2)).to.equal(owner3.address);
    });

    it("Should revert with zero owners (require string)", async function () {
      const MultiSigFactory = await ethers.getContractFactory("MultiSig");
      await expect(
        MultiSigFactory.deploy([], 1)
      ).to.be.revertedWith("Number of signers checked");
    });

    it("Should revert with zero required signers (require string)", async function () {
      const MultiSigFactory = await ethers.getContractFactory("MultiSig");
      await expect(
        MultiSigFactory.deploy([owner1.address], 0)
      ).to.be.revertedWith("Number of signers not required");
    });

    it("Should revert if required > owners (require string)", async function () {
      const MultiSigFactory = await ethers.getContractFactory("MultiSig");
      await expect(
        MultiSigFactory.deploy([owner1.address], 2)
      ).to.be.revertedWith("invalid number of signers");
    });

    it("Should revert with zero address owner (require string)", async function () {
      const MultiSigFactory = await ethers.getContractFactory("MultiSig");
      await expect(
        MultiSigFactory.deploy([ZeroAddress, owner1.address], 1)
      ).to.be.revertedWith("Invalid owner");
    });

    it("Should revert with duplicate owner (require string)", async function () {
      const MultiSigFactory = await ethers.getContractFactory("MultiSig");
      await expect(
        MultiSigFactory.deploy([owner1.address, owner1.address], 1)
      ).to.be.revertedWith("Owner not unique");
    });
  });

  // ============ SUBMIT TRANSACTION TESTS ============
  describe("submitTransaction", function () {
    it("Should allow owner to submit a transaction", async function () {
      const value: bigint = parseEther("1.0");

      await expect(
        multiSig.connect(owner1).submitTransaction(stranger.address, value)
      )
        .to.emit(multiSig, "SubmitTxn")
        .withArgs(0);
    });

    it("Should NOT auto-approve (submitter must approve separately)", async function () {
      await multiSig.connect(owner1).submitTransaction(stranger.address, parseEther("1.0"));

      // approvalStatus[0][owner1] should be FALSE after submit (your contract sets it to false)
      expect(await multiSig.approvalStatus(0, owner1.address)).to.be.false;

      // Get transaction from public array
      const txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(0);
    });

    it("Should revert when non-owner submits", async function () {
      await expect(
        multiSig.connect(nonOwner).submitTransaction(stranger.address, parseEther("1.0"))
      ).to.be.revertedWithCustomError(multiSig, "NotOwner");
    });

    it("Should revert with zero address recipient", async function () {
      await expect(
        multiSig.connect(owner1).submitTransaction(ZeroAddress, parseEther("1.0"))
      ).to.be.revertedWithCustomError(multiSig, "InvalidAddr");
    });

    it("Should increment transaction ID correctly", async function () {
      await multiSig.connect(owner1).submitTransaction(stranger.address, 100);
      await multiSig.connect(owner2).submitTransaction(stranger.address, 200);

      const txn0 = await multiSig.allTransactions(0);
      const txn1 = await multiSig.allTransactions(1);

      expect(txn0.id).to.equal(0);
      expect(txn0.value).to.equal(100);
      expect(txn1.id).to.equal(1);
      expect(txn1.value).to.equal(200);
    });
  });

  // ============ APPROVE TRANSACTION TESTS ============
  describe("approveTransaction", function () {
    beforeEach(async function () {
      await multiSig.connect(owner1).submitTransaction(stranger.address, parseEther("1.0"));
    });

    it("Should allow owner to approve a transaction", async function () {
      await expect(
        multiSig.connect(owner1).approveTransaction(0)
      )
        .to.emit(multiSig, "ApproveTxn")
        .withArgs(owner1.address, 0);

      expect(await multiSig.approvalStatus(0, owner1.address)).to.be.true;
      const txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(1);
    });

    it("⚠️ BUG: Should revert on double-approval (but assignment bug may cause unexpected behavior)", async function () {
      await multiSig.connect(owner1).approveTransaction(0);

      // NOTE: Your contract has a bug: `if (approvalStatus[txId][msg.sender] = true)`
      // This ASSIGNs true instead of comparing, so this revert may NOT work as expected.
      // Once fixed to `==`, this test should pass:
      await expect(
        multiSig.connect(owner1).approveTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "TransactionAlreadyApproved");
    });

    it("Should revert when non-owner approves", async function () {
      await expect(
        multiSig.connect(nonOwner).approveTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "NotOwner");
    });

    it("Should revert for non-existent transaction", async function () {
      await expect(
        multiSig.connect(owner1).approveTransaction(999)
      ).to.be.revertedWithCustomError(multiSig, "TransactionDoesNotExist");
    });

    it("Should revert for already executed transaction", async function () {
      // Fund contract
      await owner1.sendTransaction({
        to: await multiSig.getAddress(),
        value: parseEther("2.0"),
      });

      // Submit + approve twice to meet threshold
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      await multiSig.connect(owner3).executeTransaction(0);

      await expect(
        multiSig.connect(owner1).approveTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "TransactionAlreadyExecuted");
    });
  });

  // ============ REVOKE APPROVAL (notApproval) TESTS ============
  describe("notApproval", function () {
    beforeEach(async function () {
      await multiSig.connect(owner1).submitTransaction(stranger.address, parseEther("1.0"));
      await multiSig.connect(owner1).approveTransaction(0);
    });

    it("Should allow owner to revoke their approval", async function () {
      expect(await multiSig.approvalStatus(0, owner1.address)).to.be.true;

      await expect(
        multiSig.connect(owner1).notApproval(0)
      )
        .to.emit(multiSig, "Revert")
        .withArgs(owner1.address, 0);

      expect(await multiSig.approvalStatus(0, owner1.address)).to.be.false;
      const txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(0);
    });

    it("Should revert when revoking without prior approval", async function () {
      await expect(
        multiSig.connect(owner2).notApproval(0)
      ).to.be.revertedWithCustomError(multiSig, "TransactionNotApproved");
    });

    it("Should revert when non-owner calls notApproval", async function () {
      await expect(
        multiSig.connect(nonOwner).notApproval(0)
      ).to.be.revertedWithCustomError(multiSig, "NotOwner");
    });
  });

  // ============ EXECUTE TRANSACTION TESTS ============
  describe("executeTransaction", function () {
    const TRANSFER_VALUE: bigint = parseEther("0.5");

    beforeEach(async function () {
      // Fund the multisig contract
      await owner1.sendTransaction({
        to: await multiSig.getAddress(),
        value: parseEther("2.0"),
      });

      // Submit transaction (NO auto-approval in your contract)
      await multiSig.connect(owner1).submitTransaction(stranger.address, TRANSFER_VALUE);
    });

    it("Should execute when enough approvals", async function () {
      // Need 2 approvals: owner1 + owner2 (no auto-approve)
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);

      const initialBalance: bigint = await ethers.provider.getBalance(stranger.address);

      await expect(
        multiSig.connect(owner3).executeTransaction(0)
      )
        .to.emit(multiSig, "Execute")
        .withArgs(0);

      expect(await ethers.provider.getBalance(stranger.address)).to.equal(
        initialBalance + TRANSFER_VALUE
      );

      const txn = await multiSig.allTransactions(0);
      expect(txn.executed).to.be.true;
    });

    it("Should revert with insufficient approvals", async function () {
      // Only 1 approval, need 2
      await multiSig.connect(owner1).approveTransaction(0);

      await expect(
        multiSig.connect(owner3).executeTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "TransactionNotApproved");
    });

    it("Should revert when transaction already executed", async function () {
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      await multiSig.connect(owner3).executeTransaction(0);

      await expect(
        multiSig.connect(owner3).executeTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "TransactionAlreadyExecuted");
    });

    it("Should revert when calling with non-owner", async function () {
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);

      await expect(
        multiSig.connect(nonOwner).executeTransaction(0)
      ).to.be.revertedWithCustomError(multiSig, "NotOwner");
    });

    it("Should revert if contract has insufficient balance", async function () {
      // Submit a tx larger than contract balance
      await multiSig.connect(owner1).submitTransaction(stranger.address, parseEther("100"));
      await multiSig.connect(owner1).approveTransaction(1);
      await multiSig.connect(owner2).approveTransaction(1);

      // This will fail at the .call() level, but your contract uses require() not custom error
      // So we expect a generic revert (Hardhat shows as "Transaction execution failed")
      await expect(
        multiSig.connect(owner3).executeTransaction(1)
      ).to.be.revertedWith("Transaction execution failed");
    });
  });

  // ============ RECEIVE ETH TESTS ============
  describe("Receive ETH", function () {
    it("Should accept ETH and emit Deposit event", async function () {
      const amount: bigint = parseEther("1.0");

      await expect(
        owner1.sendTransaction({
          to: await multiSig.getAddress(),
          value: amount,
        })
      )
        .to.emit(multiSig, "Deposit")
        .withArgs(owner1.address, amount);

      expect(await ethers.provider.getBalance(await multiSig.getAddress())).to.equal(amount);
    });
  });

  // ============ EDGE CASES ============
  describe("Edge Cases", function () {
    it("Should allow execution with exactly required confirmations", async function () {
      await owner1.sendTransaction({
        to: await multiSig.getAddress(),
        value: parseEther("1.0"),
      });

      await multiSig.connect(owner1).submitTransaction(stranger.address, parseEther("0.1"));
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      // Exactly 2 approvals = requiredNumberOfSigners

      await expect(
        multiSig.connect(owner3).executeTransaction(0)
      ).to.emit(multiSig, "Execute");
    });

    it("Should handle multiple approvals and revokes correctly", async function () {
      await multiSig.connect(owner1).submitTransaction(stranger.address, 100);

      // Approve by owner1 and owner2
      await multiSig.connect(owner1).approveTransaction(0);
      await multiSig.connect(owner2).approveTransaction(0);
      let txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(2);

      // Revoke by owner1
      await multiSig.connect(owner1).notApproval(0);
      txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(1);

      // Re-approve by owner1
      await multiSig.connect(owner1).approveTransaction(0);
      txn = await multiSig.allTransactions(0);
      expect(txn.approvalCount).to.equal(2);
    });
  });
});