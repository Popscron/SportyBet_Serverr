const mongoose = require("mongoose");
const { getMongoUrl } = require("./env");

mongoose.set("strictQuery", false);

const mongoPoolMax = Number.parseInt(String(process.env.MONGO_MAX_POOL_SIZE || "25"), 10);
const mongoPoolMin = Number.parseInt(String(process.env.MONGO_MIN_POOL_SIZE || "2"), 10);

const defaultOptions = {
  maxPoolSize:
    Number.isFinite(mongoPoolMax) && mongoPoolMax >= 5
      ? Math.min(50, mongoPoolMax)
      : 10,
  minPoolSize:
    Number.isFinite(mongoPoolMin) && mongoPoolMin >= 0
      ? Math.min(10, mongoPoolMin)
      : 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

/** Last connect failure (for /health debugging on Vercel). */
let lastConnectionError = null;

/**
 * Long-running server (Node app.js): connect once at startup.
 */
function connectDatabase() {
  const mongoUrl = getMongoUrl();
  return mongoose.connect(mongoUrl, defaultOptions).then(() => {
    lastConnectionError = null;
    console.log("Connected to MongoDB");
  });
}

/** Serverless single-flight connect (one shared promise per process cold start). */
let lazyConnectionPromise = null;

const lazyOpts = {
  ...defaultOptions,
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 15000,
};

function isConnected() {
  return mongoose.connection.readyState === 1;
}

function connectMongoDBLazy() {
  if (isConnected()) {
    return Promise.resolve(true);
  }

  if (lazyConnectionPromise) {
    return lazyConnectionPromise;
  }

  const mongoUrl = getMongoUrl();
  if (!mongoUrl || mongoUrl.includes("127.0.0.1")) {
    lastConnectionError = new Error("MONGO_URL is missing or points to localhost");
    console.error("MongoDB:", lastConnectionError.message);
    return Promise.resolve(false);
  }

  lazyConnectionPromise = mongoose
    .connect(mongoUrl, lazyOpts)
    .then(() => {
      lastConnectionError = null;
      console.log("Connected to MongoDB (lazy)");
      return true;
    })
    .catch((error) => {
      lastConnectionError = error;
      console.error("Error connecting to MongoDB:", error.message);
      lazyConnectionPromise = null;
      try {
        mongoose.connection.close().catch(() => {});
      } catch (_) {
        /* ignore */
      }
      return false;
    });

  return lazyConnectionPromise;
}

function getLastConnectionError() {
  if (isConnected()) return null;
  return lastConnectionError?.message || null;
}

module.exports = {
  mongoose,
  connectDatabase,
  connectMongoDBLazy,
  isConnected,
  getLastConnectionError,
};
