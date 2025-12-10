const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with environment variables (REQUIRED - no fallback for security)
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn("⚠️  Cloudinary credentials not set in environment variables. Image uploads will fail.");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
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
