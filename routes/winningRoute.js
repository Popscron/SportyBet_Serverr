const express = require("express");
const router = express.Router();
const winningController = require("../src/controllers/winning.controller");

router.post("/winning", winningController.postWinning);

module.exports = router;
