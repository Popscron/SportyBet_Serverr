const express = require("express");
const router = express.Router();
const depositController = require("../src/controllers/deposit.controller");

router.post("/deposit", depositController.postDeposit);
router.get("/deposite/:userId", depositController.listByUser);
router.post("/withdraw", depositController.withdraw);
router.put("/update-currency", depositController.updateCurrency);

module.exports = router;
