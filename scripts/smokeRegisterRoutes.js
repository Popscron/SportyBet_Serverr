/**
 * Loads the full Express app (including registerApiRoutes) without starting a listener.
 * Fails fast if any route module throws on require or wiring breaks.
 */
require("dotenv").config();

const { createApp } = require("../src/createApp");

try {
  createApp({ serverless: false });
  console.log("smokeRegisterRoutes: OK — createApp + registerApiRoutes loaded without error.");
  process.exit(0);
} catch (err) {
  console.error("smokeRegisterRoutes: FAILED", err);
  process.exit(1);
}
