const express = require("express");
const router = express.Router();
const manualCardController = require("../src/controllers/manualCard.controller");

router.post("/manual-cards", manualCardController.create);
router.get("/manual-cards", manualCardController.listActive);
router.get("/manual-cards/broadcast", manualCardController.listForBroadcast);
router.post("/manual-cards/cleanup", manualCardController.cleanupExpired);
router.put("/manual-cards/:id", manualCardController.update);
router.delete("/manual-cards/:id", manualCardController.remove);
router.patch(
  "/manual-cards/:id/deactivate",
  manualCardController.deactivate
);

module.exports = router;
