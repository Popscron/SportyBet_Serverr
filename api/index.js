/* eslint-disable no-console */
/**
 * Vercel / serverless entry — reuses the same Express app as `app.js` via `src/createApp.js`.
 */

// Suppress Mongoose duplicate schema/index warnings in serverless (module reuse)
const originalWarn = process.emitWarning;
process.emitWarning = function suppressDupIdx(warning, ...args) {
  const warningStr =
    typeof warning === "string" ? warning : String(warning);
  if (
    warningStr.includes("Duplicate sc") ||
    warningStr.includes("Duplicate schema index") ||
    (warningStr.includes("MONGOOSE") && warningStr.includes("Duplicate"))
  ) {
    return;
  }
  return originalWarn.apply(process, [warning, ...args]);
};

const originalConsoleWarn = console.warn;
console.warn = function filterDupIdx(...args) {
  const firstArg = args[0];
  const warningStr =
    typeof firstArg === "string" ? firstArg : String(firstArg || "");
  if (
    warningStr.includes("Duplicate sc") ||
    warningStr.includes("Duplicate schema index") ||
    (warningStr.includes("MONGOOSE") && warningStr.includes("Duplicate"))
  ) {
    return;
  }
  return originalConsoleWarn.apply(console, args);
};

require("dotenv").config();

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const { connectMongoDBLazy } = require("../src/config/database");
const { createApp } = require("../src/createApp");

const app = createApp({ serverless: true });

module.exports = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 0) {
      try {
        await connectMongoDBLazy();
      } catch (error) {
        console.error("MongoDB connection error:", error.message);
      }
    }
    return app(req, res);
  } catch (error) {
    console.error("Serverless function error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "An error occurred",
      });
    }
  }
};
