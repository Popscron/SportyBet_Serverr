const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../configCloudinary");
const ImageModel = require("../models/ImagesModel");


const router = express.Router();

// Configure Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sportybet-uploads",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 720, height: 128, crop: "fill" }], // Exact banner dimensions
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Extract Cloudinary public_id from URL (format: .../upload/v123/folder/filename.ext)
const getCloudinaryPublicId = (url) => {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
  const match = url.match(/\/upload\/v\d+\/(.+)/);
  if (!match) return null;
  return match[1].replace(/\.[^.]+$/, ""); // remove extension
};

// Helper function to delete images from Cloudinary
const deleteImagesFromCloudinary = async (imageUrls) => {
  try {
    for (let url of imageUrls) {
      if (!url) continue;
      const publicId = getCloudinaryPublicId(url);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error("Error deleting images from Cloudinary:", error);
  }
};

// Update images if they exist, otherwise create a new entry
router.post("/uploadImages", upload.array("images", 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Please upload at least one image." });
    }

    // Validate dimensions for all uploaded images

    // Extract Cloudinary URLs
    const imageUrls = req.files.map((file) => file.path);

    // Find existing image document
    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      // Delete previous images from Cloudinary before updating
      await deleteImagesFromCloudinary(existingImages.images);

      // Update existing images
      existingImages.images = imageUrls;
      await existingImages.save();
      return res.status(200).json({ message: "Images updated successfully!", data: existingImages });
    } else {
      // Save new images if none exist
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

    // Validate image dimensions before processing

    const imageUrl = req.file.path;
    const bannerIndex = parseInt(req.body.bannerIndex) || 0;

    console.log('Processing upload:', { imageUrl, bannerIndex });

    // Find existing image document
    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      // Ensure we have an array of 4 images
      if (!existingImages.images || existingImages.images.length === 0) {
        existingImages.images = new Array(4).fill(null);
      }
      
      // Delete old image from Cloudinary before replacing (saves space)
      const oldUrl = existingImages.images[bannerIndex];
      if (oldUrl) {
        const oldPublicId = getCloudinaryPublicId(oldUrl);
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId);
          } catch (delErr) {
            console.warn("Could not delete old banner from Cloudinary:", delErr.message);
          }
        }
      }
      
      // Update the specific banner image
      existingImages.images[bannerIndex] = imageUrl;
      await existingImages.save();
      
      console.log('Banner updated successfully:', existingImages);
      return res.status(200).json({ 
        message: "Banner image updated successfully!", 
        imageUrl: imageUrl,
        data: existingImages 
      });
    } else {
      // Create new images array with the uploaded image at the specified position
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
      // Find the images from the database
      const images = await ImageModel.findOne();
      
      // If no images are found, return empty array instead of 404
      if (!images) {
        return res.status(200).json({ 
          message: "No images found", 
          data: { images: [] } 
        });
      }
      
      // Return the images data
      res.status(200).json({ message: "Images retrieved successfully", data: images });
    } catch (error) {
      // Handle any errors that occur during the request
      res.status(500).json({ message: "Failed to retrieve images", error: error.message });
    }
  });

module.exports = router;
