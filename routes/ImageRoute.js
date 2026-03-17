const express = require("express");
const path = require("path");
const fs = require("fs");
const upload = require("../middleware/multer");
const ImageModel = require("../models/ImagesModel");

const router = express.Router();

// Helper to delete a local file given its URL path (e.g. /uploads/filename.png)
const deleteLocalFile = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") return;
  try {
    const filename = path.basename(fileUrl);
    const filePath = path.join(__dirname, "..", "uploads", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting local file:", error);
  }
};

// Helper to delete multiple local files
const deleteLocalFiles = (fileUrls) => {
  if (!Array.isArray(fileUrls)) return;
  for (const url of fileUrls) {
    if (url) deleteLocalFile(url);
  }
};

// Update images if they exist, otherwise create a new entry
router.post("/uploadImages", upload.array("images", 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Please upload at least one image." });
    }

    const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);

    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      deleteLocalFiles(existingImages.images);
      existingImages.images = imageUrls;
      await existingImages.save();
      return res.status(200).json({ message: "Images updated successfully!", data: existingImages });
    } else {
      const newImages = new ImageModel({ images: imageUrls });
      await newImages.save();
      return res.status(201).json({ message: "Images uploaded successfully!", data: newImages });
    }
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

// Upload single image and update specific banner position
router.post("/uploadSingleImage", upload.single("images"), async (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      bannerIndex: req.body.bannerIndex,
      fileInfo: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ message: "Please upload an image." });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const bannerIndex = parseInt(req.body.bannerIndex) || 0;

    console.log('Processing upload:', { imageUrl, bannerIndex });

    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      if (!existingImages.images || existingImages.images.length === 0) {
        existingImages.images = new Array(4).fill(null);
      }

      const oldUrl = existingImages.images[bannerIndex];
      if (oldUrl) {
        try {
          deleteLocalFile(oldUrl);
        } catch (delErr) {
          console.warn("Could not delete old banner file:", delErr.message);
        }
      }

      existingImages.images[bannerIndex] = imageUrl;
      await existingImages.save();

      console.log('Banner updated successfully:', existingImages);
      return res.status(200).json({
        message: "Banner image updated successfully!",
        imageUrl: imageUrl,
        data: existingImages
      });
    } else {
      const images = new Array(4).fill(null);
      images[bannerIndex] = imageUrl;

      const newImages = new ImageModel({ images: images });
      await newImages.save();

      console.log('New banner created successfully:', newImages);
      return res.status(201).json({
        message: "Banner image uploaded successfully!",
        imageUrl: imageUrl,
        data: newImages
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get("/getImages", async (req, res) => {
  try {
    const images = await ImageModel.findOne();

    if (!images) {
      return res.status(200).json({
        message: "No images found",
        data: { images: [] }
      });
    }

    res.status(200).json({ message: "Images retrieved successfully", data: images });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve images", error: error.message });
  }
});

module.exports = router;
