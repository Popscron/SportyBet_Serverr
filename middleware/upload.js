const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
// In serverless (Vercel), ALWAYS use memory storage - disk storage doesn't work
let storage;

// Check if we're in a serverless environment (Vercel sets VERCEL env var)
// Also check NODE_ENV and if uploads directory check fails
const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV;

if (isServerless) {
  // Use memory storage for serverless - files will be in memory
  // Note: For production, you should use Cloudinary instead
  storage = multer.memoryStorage();
  console.log('Using memory storage (serverless environment detected)');
} else {
  // Use disk storage for local development only
  const uploadPath = path.join(__dirname, '..', 'uploads');
  
  // Create folder if it doesn't exist (only in local dev)
  try {
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
  } catch (error) {
    // If we can't create directory, fall back to memory storage
    console.warn('⚠️  Cannot create uploads directory, using memory storage instead');
    storage = multer.memoryStorage();
  }
  
  if (!storage) {
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
}

// ✅ Accept specific fields (leftLogo and rightLogo)
const upload = multer({ storage }).fields([
  { name: 'leftLogo', maxCount: 1 },
  { name: 'rightLogo', maxCount: 1 }
]);

module.exports = upload;
