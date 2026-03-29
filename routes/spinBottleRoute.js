const express = require("express");
const router = express.Router();
const spinBottleController = require("../src/controllers/spinBottle.controller");

router.get("/spin-bottle/result", spinBottleController.getCurrentResult);
router.post("/spin-bottle/mark-used", spinBottleController.markUsed);
router.post("/spin-bottle/bet", spinBottleController.placeBet);
router.get("/spin-bottle/bet-history", spinBottleController.betHistory);

module.exports = router;
