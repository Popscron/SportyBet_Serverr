const multer = require("multer");
const path = require("path");
const fs = require("fs");

// In Vercel/serverless, the filesystem at `/var/task` is not writable.
// `/tmp` is writable, but content is not guaranteed to persist long-term.
let storage;
const isServerless =
  process.env.VERCEL ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV;

const uploadPath = isServerless ? path.join("/tmp", "uploads") : path.join(__dirname, "..", "uploads");

try {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
} catch (err) {
  // Last resort: avoid crashing, but upload handlers relying on filename may not work well.
  storage = multer.memoryStorage();
}

if (!storage) {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() +
        "-" +
        file.fieldname +
        path.extname(file.originalname);
      cb(null, uniqueName);
    },
  });
}

module.exports = multer({
  storage,
  /** Match reverse-proxy limits (nginx often defaults to 1m — see deploy/nginx.client_max_body_size.conf.example). */
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpg/jpeg/png files are allowed!"), false);
    }
  },
});
