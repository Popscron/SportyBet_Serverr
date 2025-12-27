const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BankAccount = require("../models/BankAccount");
const User = require("../models/user");

// ============================
// @route   GET /api/bank-accounts/:userId
// @desc    Get all bank accounts for a user
// ============================
router.get("/bank-accounts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const accounts = await BankAccount.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      accounts: accounts,
    });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ============================
// @route   POST /api/bank-accounts
// @desc    Create a new bank account
// ============================
router.post("/bank-accounts", async (req, res) => {
  try {
    const { userId, name, accountName, accountNumber, isDefault } = req.body;

    if (!userId || !name || !accountName || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, name, accountName, accountNumber",
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let shouldBeDefault = isDefault || false;

    // If this is set as default, unset other defaults
    if (shouldBeDefault) {
      await BankAccount.updateMany({ userId }, { isDefault: false });
    } else {
      // If no default exists, make this one default
      const existingDefault = await BankAccount.findOne({ userId, isDefault: true });
      if (!existingDefault) {
        shouldBeDefault = true;
      }
    }

    const newAccount = new BankAccount({
      userId,
      name,
      accountName,
      accountNumber,
      isDefault: shouldBeDefault,
    });

    await newAccount.save();

    res.status(201).json({
      success: true,
      message: "Bank account created successfully",
      account: newAccount,
    });
  } catch (error) {
    console.error("Error creating bank account:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ============================
// @route   PUT /api/bank-accounts/:accountId
// @desc    Update a bank account
// ============================
router.put("/bank-accounts/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { userId, name, accountName, accountNumber, isDefault } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const account = await BankAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: "Bank account not found" });
    }

    // Verify the account belongs to the user
    if (account.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await BankAccount.updateMany({ userId, _id: { $ne: accountId } }, { isDefault: false });
    }

    // Update account
    account.name = name || account.name;
    account.accountName = accountName || account.accountName;
    account.accountNumber = accountNumber || account.accountNumber;
    if (isDefault !== undefined) {
      account.isDefault = isDefault;
    }

    await account.save();

    res.status(200).json({
      success: true,
      message: "Bank account updated successfully",
      account: account,
    });
  } catch (error) {
    console.error("Error updating bank account:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ============================
// @route   DELETE /api/bank-accounts/:accountId
// @desc    Delete a bank account
// ============================
router.delete("/bank-accounts/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    if (!accountId) {
      return res.status(400).json({ success: false, message: "Account ID is required" });
    }

    let account;
    
    // Validate accountId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      // Try to find by MongoDB _id
      account = await BankAccount.findById(accountId);
    }
    
    // If not found by _id, try to find by accountNumber (for accounts created before _id was stored)
    if (!account && req.body.accountNumber) {
      account = await BankAccount.findOne({ 
        userId: userId,
        accountNumber: req.body.accountNumber 
      });
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: "Bank account not found",
        accountId: accountId 
      });
    }

    // Verify the account belongs to the user - handle both string and ObjectId comparison
    const accountUserId = account.userId.toString();
    const requestUserId = userId.toString();
    
    if (accountUserId !== requestUserId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await BankAccount.findByIdAndDelete(accountId);

    res.status(200).json({
      success: true,
      message: "Bank account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    console.error("Error details:", {
      accountId: req.params.accountId,
      userId: req.body.userId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ============================
// @route   POST /api/bank-accounts/sync
// @desc    Sync all bank accounts for a user (bulk update)
// ============================
router.post("/bank-accounts/sync", async (req, res) => {
  try {
    const { userId, accounts } = req.body;

    if (!userId || !Array.isArray(accounts)) {
      return res.status(400).json({
        success: false,
        message: "User ID and accounts array are required",
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Delete all existing accounts for this user
    await BankAccount.deleteMany({ userId });

    // Create new accounts
    const newAccounts = accounts.map((acc) => ({
      userId,
      name: acc.name,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber,
      isDefault: acc.isDefault || false,
    }));

    // Ensure only one default
    const defaultCount = newAccounts.filter((acc) => acc.isDefault).length;
    if (defaultCount > 1) {
      // Keep first default, unset others
      let foundFirst = false;
      newAccounts.forEach((acc) => {
        if (acc.isDefault && !foundFirst) {
          foundFirst = true;
        } else if (acc.isDefault) {
          acc.isDefault = false;
        }
      });
    } else if (defaultCount === 0 && newAccounts.length > 0) {
      // Set first account as default if none exists
      newAccounts[0].isDefault = true;
    }

    const savedAccounts = await BankAccount.insertMany(newAccounts);

    res.status(200).json({
      success: true,
      message: "Bank accounts synced successfully",
      accounts: savedAccounts,
    });
  } catch (error) {
    console.error("Error syncing bank accounts:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

module.exports = router;

