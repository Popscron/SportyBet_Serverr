const mongoose = require("mongoose");
const { getMongoUrl } = require("./env");

mongoose.set("strictQuery", false);

const defaultOptions = {
  maxPoolSize: 50,
  minPoolSize: 5,
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
