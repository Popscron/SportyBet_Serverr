const express = require("express");
const router = express.Router();
const nextUpdateController = require("../src/controllers/nextUpdate.controller");

router.get("/next-update-date", nextUpdateController.getNextUpdateDate);
router.post(
  "/next-update-date/initialize",
  nextUpdateController.initialize
);

module.exports = router;
