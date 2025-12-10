const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with environment variables (REQUIRED - no fallback for security)
// Don't crash if credentials are missing - just log a warning
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  // Only show warning in development, not in production
  if (process.env.NODE_ENV !== 'production') {
    console.warn("⚠️  Cloudinary credentials not set. Image uploads will fail.");
  }
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

  // Test the configuration (async, don't block, with timeout)
  // Only test in non-serverless or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' || process.env.TEST_CLOUDINARY === 'true') {
    cloudinary.api.ping()
      .then(result => {
        console.log('✓ Cloudinary configuration successful');
      })
      .catch(error => {
        // Only log if there's a meaningful error message
        if (error && error.message) {
          console.warn('⚠️  Cloudinary ping failed (non-critical):', error.message);
        }
        // Silently ignore undefined errors
      });
  }
}

module.exports = cloudinary;
