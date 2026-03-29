const express = require("express");
const router = express.Router();
const profileImageController = require("../src/controllers/profileImage.controller");

router.post("/proimages", profileImageController.createMany);
router.get("/proimages", profileImageController.listAll);

module.exports = router;
