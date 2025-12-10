const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Folder where images will be stored
const uploadPath = path.join(__dirname, '..', 'uploads');

// Create folder if it doesn't exist (skip in serverless environments like Vercel)
// In serverless, we should use Cloudinary instead of local file storage
try {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
} catch (error) {
  // In serverless environments (like Vercel), we can't create directories
  // This is expected - use Cloudinary for file uploads instead
  console.warn('⚠️  Cannot create uploads directory (serverless environment). Use Cloudinary for file uploads.');
}

// Configure multer storage
// In serverless (Vercel), use memory storage instead of disk storage
let storage;

// Check if we're in a serverless environment (Vercel sets VERCEL env var)
if (process.env.VERCEL || !fs.existsSync(uploadPath)) {
  // Use memory storage for serverless - files will be in memory
  // Note: For production, you should use Cloudinary instead
  storage = multer.memoryStorage();
  console.log('Using memory storage (serverless environment)');
} else {
  // Use disk storage for local development
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + file.fieldname + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });
}

// ✅ Accept specific fields (leftLogo and rightLogo)
const upload = multer({ storage }).fields([
  { name: 'leftLogo', maxCount: 1 },
  { name: 'rightLogo', maxCount: 1 }
]);

module.exports = upload;
