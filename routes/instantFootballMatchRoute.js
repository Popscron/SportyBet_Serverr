const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const instantFootballMatchController = require("../src/controllers/instantFootballMatch.controller");

router.get(
  "/instant-football/matches",
  instantFootballMatchController.listMatches
);
router.post(
  "/instant-football/matches",
  upload,
  instantFootballMatchController.createMatch
);
router.put(
  "/instant-football/matches/:id",
  instantFootballMatchController.updateMatch
);
router.delete(
  "/instant-football/matches/:id",
  instantFootballMatchController.deleteMatch
);

module.exports = router;
