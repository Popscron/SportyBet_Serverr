const express = require("express");
const router = express.Router();
const walletController = require("../src/controllers/wallet.controller");

router.post("/deposit", walletController.deposit);
router.post("/deposit/send-sms", walletController.depositSendSms);
router.post("/withdraw", walletController.withdraw);

router.get("/history/:userId", walletController.getHistory);

router.get("/deposite/:userId", walletController.getBalance);

router.put("/update-currency", walletController.updateCurrency);

router.delete(
  "/transactions/user/:userId",
  walletController.deleteAllUserTransactions
);
router.delete("/transaction/:transactionId", walletController.deleteTransaction);

module.exports = router;
