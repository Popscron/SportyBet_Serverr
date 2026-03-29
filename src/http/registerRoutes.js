const path = require("path");

/**
 * Mounts all API routers. Paths and order match legacy app.js so clients stay compatible.
 * Route modules live under project root `/routes` (not under `src/`).
 */
function registerApiRoutes(app) {
  const routesDir = path.join(__dirname, "..", "..", "routes");

  const otpRoutes = require(path.join(routesDir, "authRoutes"));
  const betRoute = require(path.join(routesDir, "betRoute"));
  const multibet = require(path.join(routesDir, "multibetRoutes"));
  const verifycodeRoute = require(path.join(routesDir, "verifyCodeRoute.js"));
  const oddRoute = require(path.join(routesDir, "oddRoute.js"));
  const cashOut = require(path.join(routesDir, "cashoutRoute.js"));
  const imageRoutes = require(path.join(routesDir, "ImageRoute.js"));
  const matchesRoutes = require(path.join(routesDir, "matchesRoute.js"));
  const topmatchesRoutes = require(path.join(routesDir, "topMatchRoute.js"));
  const WalletRoutes = require(path.join(routesDir, "wallet.js"));
  const WinningRoutes = require(path.join(routesDir, "winningRoute.js"));
  const addonRoutes = require(path.join(routesDir, "addonRoute.js"));
  const useraddonRoutes = require(path.join(routesDir, "userAddonRoute.js"));
  const proImgRoutes = require(path.join(routesDir, "profileImageRoute.js"));
  const userImgRoutes = require(path.join(routesDir, "UserImageRoute.js"));
  const BookingRoutes = require(path.join(routesDir, "BookingRoute.js"));
  const notification = require(path.join(routesDir, "notification.js"));
  const manualCardRoutes = require(path.join(routesDir, "manualCardRoute.js"));
  const spinBottleRoutes = require(path.join(routesDir, "spinBottleRoute.js"));
  const heroCrashRoutes = require(path.join(routesDir, "heroCrashRoute.js"));
  const virtualGameRoutes = require(path.join(routesDir, "virtualGameRoute.js"));
  const instantFootballMatchRoutes = require(
    path.join(routesDir, "instantFootballMatchRoute.js")
  );
  const maxBonusRoutes = require(path.join(routesDir, "maxBonusRoute.js"));
  const bankAccountRoutes = require(path.join(routesDir, "bankAccountRoute.js"));
  const adminRoutes = require(path.join(routesDir, "adminRoutes.js"));
  const nextUpdateRoutes = require(path.join(routesDir, "nextUpdateRoute.js"));
  const smsRoutes = require(path.join(routesDir, "smsRoute.js"));
  const spindictRoutes = require(path.join(routesDir, "spindictRoutes"));
  const oneWinAuthRoutes = require(path.join(routesDir, "1win", "auth"));
  const oneWinAdminRoutes = require(path.join(routesDir, "1win", "admin"));
  const oneWinPaymentRoutes = require(path.join(routesDir, "1win", "payments"));

  app.get("/api", (req, res) => {
    res.json({ message: "API running successfully" });
  });

  app.use("/api", otpRoutes);
  app.use("/api", betRoute);
  app.use("/api", multibet);
  app.use("/api", verifycodeRoute);
  app.use("/api", oddRoute);
  app.use("/api", cashOut);
  app.use("/api", imageRoutes);
  app.use("/api", matchesRoutes);
  app.use("/api", topmatchesRoutes);
  app.use("/api", WalletRoutes);
  app.use("/api", WinningRoutes);
  app.use("/api", addonRoutes);
  app.use("/api", useraddonRoutes);
  app.use("/api", proImgRoutes);
  app.use("/api", userImgRoutes);
  app.use("/api", BookingRoutes);
  app.use("/api", notification);
  app.use("/api", manualCardRoutes);
  app.use("/api", spinBottleRoutes);
  app.use("/api", heroCrashRoutes);
  app.use("/api", virtualGameRoutes);
  app.use("/api", instantFootballMatchRoutes);
  app.use("/api", maxBonusRoutes);
  app.use("/api", bankAccountRoutes);
  app.use("/api", nextUpdateRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/sms", smsRoutes);

  app.use("/api/spindict", spindictRoutes);

  app.use("/api/1win/auth", oneWinAuthRoutes);
  app.use("/api/1win/admin", oneWinAdminRoutes);
  app.use("/api/1win/payments", oneWinPaymentRoutes);
}

module.exports = { registerApiRoutes };
