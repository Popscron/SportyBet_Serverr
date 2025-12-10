const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with environment variables (REQUIRED - no fallback for security)
// Don't crash if credentials are missing - just log a warning
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn("⚠️  Cloudinary credentials not set in environment variables. Image uploads will fail.");
  // Set dummy values to prevent crashes, but functions will fail gracefully
  cloudinary.config({
    cloud_name: 'dummy',
    api_key: 'dummy',
    api_secret: 'dummy'
  });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  // Test the configuration (async, don't block)
  cloudinary.api.ping()
    .then(result => {
      console.log('Cloudinary configuration successful:', result);
    })
    .catch(error => {
      console.error('Cloudinary configuration failed:', error.message);
      // Don't crash - just log the error
    });
}

module.exports = cloudinary;
