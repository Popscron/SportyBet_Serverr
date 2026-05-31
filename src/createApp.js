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
const { connectMongoDBLazy, mongoose, isConnected, getLastConnectionError } = require("./config/database");

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

  // Behind Nginx / a load balancer so express-rate-limit and req.ip are correct
  if (String(process.env.TRUST_PROXY || "1").toLowerCase() !== "0") {
    app.set("trust proxy", 1);
  }

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
      // In Vercel serverless, disk persistence for `./uploads` isn't guaranteed.
      // `/tmp/uploads` is writable and used by our Vercel-safe multer config.
      const localUploadsPath = path.join(ROOT, "uploads");
      const tmpUploadsPath = path.join("/tmp", "uploads");

      if (fs.existsSync(localUploadsPath)) {
        app.use("/uploads", express.static(localUploadsPath));
      } else if (fs.existsSync(tmpUploadsPath)) {
        app.use("/uploads", express.static(tmpUploadsPath));
      }
    } catch (_) {
      /* serverless: optional */
    }
  }

  if (serverless) {
    app.use(async (req, res, next) => {
      const path = req.path || req.url || "";
      if (path === "/health" || path === "/" || path === "/favicon.ico") {
        return next();
      }

      if (!isConnected()) {
        await connectMongoDBLazy();
      }

      if (!isConnected() && path.startsWith("/api")) {
        return res.status(503).json({
          success: false,
          message:
            "Database unavailable. Verify MONGO_URL on Vercel and MongoDB Atlas Network Access (allow 0.0.0.0/0).",
          dbError: getLastConnectionError(),
        });
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
