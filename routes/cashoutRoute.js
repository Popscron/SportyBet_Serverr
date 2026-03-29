const express = require("express");
const router = express.Router();
const cashoutController = require("../src/controllers/cashout.controller");

router.put("/cashout/:betId", cashoutController.upsertByBetId);
router.get("/cashout/:betId", cashoutController.getByBetId);
router.get("/cashout", cashoutController.listAll);

module.exports = router;
