const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { v2: cloudinary } = require("cloudinary");
const dotenv = require("dotenv");

dotenv.config();

// Use environment variables if available, otherwise use fallback (for local dev)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcwc3ehp3",
  api_key: process.env.CLOUDINARY_API_KEY || "283419252513685",
  api_secret: process.env.CLOUDINARY_API_SECRET || "gGz5YtguIm-W42mabvpOsSSF_7c",
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Folder name in Cloudinary
    allowedFormats: ["jpeg", "png", "jpg"],
    transformation: [{ width: 500, height: 500, crop: "limit" }], // Resize images
  },
});
module.exports = multer({ storage });


