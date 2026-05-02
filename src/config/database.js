const mongoose = require("mongoose");
const { getMongoUrl } = require("./env");

mongoose.set("strictQuery", false);

const mongoPoolMax = Number.parseInt(String(process.env.MONGO_MAX_POOL_SIZE || "25"), 10);
const mongoPoolMin = Number.parseInt(String(process.env.MONGO_MIN_POOL_SIZE || "2"), 10);

const defaultOptions = {
  maxPoolSize:
    Number.isFinite(mongoPoolMax) && mongoPoolMax >= 5
      ? Math.min(50, mongoPoolMax)
      : 25,
  minPoolSize:
    Number.isFinite(mongoPoolMin) && mongoPoolMin >= 0
      ? Math.min(10, mongoPoolMin)
      : 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

/**
 * Long-running server (Node app.js): connect once at startup.
 */
function connectDatabase() {
  const mongoUrl = getMongoUrl();
  return mongoose.connect(mongoUrl, defaultOptions).then(() => {
    console.log("Connected to MongoDB");
  });
}

/** Serverless single-flight connect (one shared promise per process cold start). */
let lazyConnectionPromise = null;
const lazyOpts = { serverSelectionTimeoutMS: 5000 };

function connectMongoDBLazy() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(true);
  }
  if (lazyConnectionPromise) {
    return lazyConnectionPromise;
  }
  const mongoUrl = getMongoUrl();
  lazyConnectionPromise = mongoose
    .connect(mongoUrl, lazyOpts)
    .then(() => {
      console.log("Connected to MongoDB");
      return true;
    })
    .catch((error) => {
      console.error("Error connecting to MongoDB:", error.message);
      lazyConnectionPromise = null;
      return false;
    });
  return lazyConnectionPromise;
}

module.exports = {
  mongoose,
  connectDatabase,
  connectMongoDBLazy,
};
