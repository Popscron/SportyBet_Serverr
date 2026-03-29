const express = require("express");
const router = express.Router();
const oddController = require("../src/controllers/odd.controller");

router.get("/odd/:betId", oddController.getByBetId);
router.put("/odd/:betId", oddController.upsertByBetId);

module.exports = router;
