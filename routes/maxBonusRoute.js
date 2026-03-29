const express = require("express");
const router = express.Router();
const maxBonusController = require("../src/controllers/maxBonus.controller");

router.get("/max-bonus", maxBonusController.listByUser);
router.get(
  "/max-bonus/by-booking-code",
  maxBonusController.getByBookingCode
);
router.post("/max-bonus", maxBonusController.create);
router.put("/max-bonus/:id", maxBonusController.update);
router.delete("/max-bonus/:id", maxBonusController.remove);

module.exports = router;
