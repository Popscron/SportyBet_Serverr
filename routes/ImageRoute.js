const express = require("express");
const upload = require("../middleware/multer");
const imageBannerController = require("../src/controllers/imageBanner.controller");

const router = express.Router();

router.post(
  "/uploadImages",
  upload.array("images", 4),
  imageBannerController.uploadImages
);
router.post(
  "/uploadSingleImage",
  upload.single("images"),
  imageBannerController.uploadSingleImage
);
router.get("/getImages", imageBannerController.getImages);

module.exports = router;
