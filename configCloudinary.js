const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with environment variables or fallback to hardcoded values
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dir5lv73s",
  api_key: process.env.CLOUDINARY_API_KEY || "522134132512322",
  api_secret: process.env.CLOUDINARY_API_SECRET || "CKkwDdGy6upFsnt9HgFhIIHxuMo"
});

// Test the configuration
cloudinary.api.ping()
  .then(result => {
    console.log('Cloudinary configuration successful:', result);
  })
  .catch(error => {
    console.error('Cloudinary configuration failed:', error);
  });

module.exports = cloudinary;
