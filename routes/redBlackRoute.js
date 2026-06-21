const express = require("express");
const router = express.Router();
const redBlackController = require("../src/controllers/redBlack.controller");

router.post("/red-black/round", redBlackController.startRound);
router.get("/red-black/round", redBlackController.getRound);
router.post("/red-black/play", redBlackController.playHand);
router.post("/red-black/round/end", redBlackController.endRound);
router.get("/red-black/bet-history", redBlackController.betHistory);
router.get("/red-black/result", redBlackController.getCurrentResult);
router.post("/red-black/mark-used", redBlackController.markResultUsed);

module.exports = router;
