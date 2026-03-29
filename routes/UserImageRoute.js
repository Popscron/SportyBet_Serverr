const express = require("express");
const router = express.Router();
const userImageSelectionController = require("../src/controllers/userImageSelection.controller");

router.get("/profile-images", userImageSelectionController.listProfileImages);
router.put(
  "/user-image/:userId",
  userImageSelectionController.setUserImage
);
router.get("/user-image/:userId", userImageSelectionController.getUserImage);

module.exports = router;
