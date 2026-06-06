const express = require("express");
const router = express.Router();
const appUpdateController = require("../src/controllers/appUpdate.controller");

router.get("/app-update-config", appUpdateController.getPublicConfig);

module.exports = router;
