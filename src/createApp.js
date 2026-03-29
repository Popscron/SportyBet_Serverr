const express = require("express");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { applyCors } = require("./config/cors");
const { applyApiRateLimit } = require("./config/rateLimit");
const { registerApiRoutes } = require("./http/registerRoutes");
const pushRoutes = require("./http/pushRoutes");
const { registerWellKnownRoutes } = require("./http/wellKnown");
const { connectMongoDBLazy, mongoose } = require("./config/database");

const ROOT = path.join(__dirname, "..");

function ensureUploadsDir() {
  const uploadsDir = path.join(ROOT, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.serverless=false] — lazy Mongo per request + health uses lazy connect
 */
function createApp(opts = {}) {
  const serverless = Boolean(opts.serverless);
  const app = express();

  applyCors(app);
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));

  if (!serverless) {
    ensureUploadsDir();
    app.use("/uploads", express.static(path.join(ROOT, "uploads"), {
      maxAge: "1d",
      immutable: true,
    }));
  } else {
    try {
      const uploadsPath = path.join(ROOT, "uploads");
      if (fs.existsSync(uploadsPath)) {
        app.use("/uploads", express.static(uploadsPath));
      }
    } catch (_) {
      /* serverless: optional */
    }
  }

  if (serverless) {
    app.use(async (req, res, next) => {
      if (req.path === "/health") {
        return next();
      }
      if (mongoose.connection.readyState === 0) {
        try {
          await connectMongoDBLazy();
        } catch (error) {
          console.error(
            "MongoDB connection error in middleware:",
            error.message
          );
        }
      }
      return next();
    });
  }

  applyApiRateLimit(app);

  registerWellKnownRoutes(app, { serverless });
  registerApiRoutes(app);

  app.use(pushRoutes);

  return app;
}

module.exports = { createApp };
