// routes/notification.js
const express = require("express");
const NotificationBalance = require("../models/NotificationBalance.js");

const router = express.Router();

// ✅ Get user balance
router.get("/notification/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let balanceDoc = await NotificationBalance.findOne({ userId });

    if (!balanceDoc) {
      // if user doesn't have balance record yet, create one
      balanceDoc = await NotificationBalance.create({
        userId,
        currentBalance: 0,
      });
    }

    res.json({ currentBalance: balanceDoc.currentBalance });
  } catch (error) {
    console.error("Balance Fetch Error:", error);
    res.status(500).json({ message: "Failed to fetch balance" });
  }
});

// ✅ Update balance (add or subtract)
router.post("/notification/update-balance", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    let balanceDoc = await NotificationBalance.findOne({ userId });

    if (!balanceDoc) {
      balanceDoc = await NotificationBalance.create({
        userId,
        currentBalance: 0,
      });
    }

    balanceDoc.currentBalance = amount;
    await balanceDoc.save();

    res.json({ currentBalance: balanceDoc.currentBalance });
  } catch (error) {
    console.error("Balance Update Error:", error);
    res.status(500).json({ message: "Failed to update balance" });
  }
});

module.exports = router;
