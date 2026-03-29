const express = require("express");
const router = express.Router();
const verifyCodeController = require("../src/controllers/verifyCode.controller");

router.get("/verify-code/:betId", verifyCodeController.getOrCreateByBetId);
router.put("/verify-code/:betId", verifyCodeController.upsertByBetId);
router.delete("/verify-code/:betId", verifyCodeController.deleteByBetId);
router.get(
  "/betverify-code/:verifyCode",
  verifyCodeController.getMatchByVerifyCode
);

module.exports = router;
