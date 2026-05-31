/**
 * Central env accessors (dotenv should be loaded in app.js / server entry first).
 */
function getPort() {
  return Number(process.env.PORT) || 5008;
}

function getMongoUrl() {
  return process.env.MONGO_URL || "mongodb://127.0.0.1:27017/SportyBetDB";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

module.exports = {
  getPort,
  getMongoUrl,
  isProduction,
};
