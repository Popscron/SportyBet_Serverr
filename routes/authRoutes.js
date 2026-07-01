const express = require("express");
const router = express.Router();
const { login } = require("../src/services/auth/login.service");
const {
  requestMinigenLogin,
  getPendingMinigenCode,
  verifyMinigenLogin,
} = require("../src/services/auth/minigenLogin.service");
const authMiddleware = require("../middleware/authMiddleware");
const legacyRouter = require("./authLegacy.routes");

router.post("/login", login);
router.post("/auth/minigen/login-request", requestMinigenLogin);
router.get("/auth/minigen/pending-code", authMiddleware, getPendingMinigenCode);
router.post("/auth/minigen/verify-login", verifyMinigenLogin);
router.use(legacyRouter);

module.exports = router;
