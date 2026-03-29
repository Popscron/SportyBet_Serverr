const express = require("express");
const router = express.Router();
const userAddonController = require("../src/controllers/userAddon.controller");

router.post("/addon/buy", userAddonController.buyAddon);
router.get("/all/:userId", userAddonController.listAllForUser);

module.exports = router;
