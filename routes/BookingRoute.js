const express = require("express");
const router = express.Router();
const bookingController = require("../src/controllers/booking.controller");

router.post("/place", bookingController.place);
router.post("/place-from-collapsed", bookingController.placeFromCollapsed);

module.exports = router;
