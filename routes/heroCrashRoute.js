const express = require("express");
const router = express.Router();
const heroCrashController = require("../src/controllers/heroCrash.controller");

router.get("/sporty-hero/result", heroCrashController.getCurrentResult);
router.post("/sporty-hero/mark-used", heroCrashController.markUsed);
router.post("/sporty-hero/bet", heroCrashController.placeBet);
router.post("/sporty-hero/cashout", heroCrashController.cashout);
router.post("/sporty-hero/crash", heroCrashController.applyCrash);
router.get("/sporty-hero/bet-history", heroCrashController.betHistory);

module.exports = router;
