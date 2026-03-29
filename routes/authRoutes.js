const express = require("express");
const router = express.Router();
const { login } = require("../src/services/auth/login.service");
const legacyRouter = require("./authLegacy.routes");

router.post("/login", login);
router.use(legacyRouter);

module.exports = router;
