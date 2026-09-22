const express = require("express");
const router = express.Router();
const aviatorController = require("../src/controllers/aviator.controller");

router.get("/aviator/result", aviatorController.getCurrentResult);
router.post("/aviator/mark-used", aviatorController.markUsed);
router.post("/aviator/bet", aviatorController.placeBet);
router.post("/aviator/cancel", aviatorController.cancelBet);
router.post("/aviator/cashout", aviatorController.cashout);
router.post("/aviator/crash", aviatorController.applyCrash);
router.get("/aviator/bet-history", aviatorController.betHistory);

module.exports = router;
