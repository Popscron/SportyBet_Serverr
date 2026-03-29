const express = require("express");
const router = express.Router();
const multibetController = require("../src/controllers/multibet.controller");

router.post("/multibets", multibetController.createMultibets);
router.post("/add-match", multibetController.addMatch);
router.post("/add-match1", multibetController.addMatch1);

router.get("/multibets/:userId", multibetController.listByBetUserId);
router.get("/multibet/:userId1", multibetController.listByRealUserId);

router.put(
  "/multibets/update/:id",
  multibetController.updateMultibetFields
);
router.put("/multibets/chat/:id", multibetController.updateChat);
router.put("/multibets/liveodd/:id", multibetController.updateLiveOdd);
router.put("/multibets/:id", multibetController.updateMultibet);

module.exports = router;
