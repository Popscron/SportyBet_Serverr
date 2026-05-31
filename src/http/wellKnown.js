const { mongoose, connectMongoDBLazy } = require("../config/database");

/**
 * Health, favicon, root metadata — safe for serverless + traditional server.
 */
function registerWellKnownRoutes(app, { serverless = false } = {}) {
  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  app.get("/favicon.png", (req, res) => {
    res.status(204).end();
  });

  app.get("/", (req, res) => {
    try {
      res.json({
        success: true,
        message: "SportyBet API",
        version: "1.0.0",
        endpoints: {
          api: "/api",
          auth: "/api/login",
          admin: "/api/admin",
          health: "/health",
          spindict: "/api/spindict",
          oneWinAuth: "/api/1win/auth",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Root route error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  });

  app.get("/health", async (req, res) => {
    try {
      if (serverless) {
        await connectMongoDBLazy();
      }
      res.json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
        mongodb:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        env: {
          hasMongoUrl: !!process.env.MONGO_URL,
          nodeEnv: process.env.NODE_ENV,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Health check failed",
        error: error.message,
      });
    }
  });
}

module.exports = { registerWellKnownRoutes };
