const express = require("express");
const router = express.Router();
const matchesController = require("../src/controllers/matches.controller");

router.post("/matches", matchesController.saveManyMatches);
router.post("/matches/single", matchesController.createSingleMatch);
router.get("/matches", matchesController.listMatches);
router.patch("/matches/:id", matchesController.patchMatch);
router.patch("/matches/:id/status", matchesController.patchMatchStatus);

module.exports = router;
