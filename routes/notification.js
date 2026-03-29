const express = require("express");
const router = express.Router();
const notificationBalanceController = require("../src/controllers/notificationBalance.controller");

router.get("/notification/:userId", notificationBalanceController.getBalance);
router.post(
  "/notification/update-balance",
  notificationBalanceController.updateBalance
);

module.exports = router;
