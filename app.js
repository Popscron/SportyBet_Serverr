/**
 * Entry point — loads env then starts the HTTP server.
 * Application structure lives under `/src` (config, http, createApp).
 */
require("dotenv").config();
const { startServer } = require("./src/server");

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
