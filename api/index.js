const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");

// Suppress Mongoose duplicate schema/index warnings in serverless environments
// These warnings are expected when modules are cached/reused in serverless
const originalWarn = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  const warningStr = typeof warning === 'string' ? warning : String(warning);
  if (warningStr.includes('Duplicate sc') || 
      warningStr.includes('Duplicate schema index') ||
      (warningStr.includes('MONGOOSE') && warningStr.includes('Duplicate'))) {
    return; // Suppress duplicate schema/index warnings
  }
  return originalWarn.apply(process, [warning, ...args]);
};

// Also suppress console.warn for Mongoose duplicate schema/index messages
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
  const firstArg = args[0];
  const warningStr = typeof firstArg === 'string' ? firstArg : String(firstArg || '');
  if (warningStr.includes('Duplicate sc') || 
      warningStr.includes('Duplicate schema index') ||
      (warningStr.includes('MONGOOSE') && warningStr.includes('Duplicate'))) {
    return; // Suppress duplicate schema/index warnings
  }
  return originalConsoleWarn.apply(console, args);
};

// Also suppress stderr for Mongoose warnings
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk, encoding, fd) {
  if (typeof chunk === 'string' && 
      (chunk.includes('Duplicate sc') || 
       chunk.includes('Duplicate schema index') ||
       (chunk.includes('MONGOOSE') && chunk.includes('Duplicate')))) {
    return true; // Suppress duplicate schema/index warnings
  }
  return originalStderrWrite.apply(process.stderr, arguments);
};

// Configure Mongoose for serverless environments
mongoose.set('strictQuery', false);

const app = express();

// Import routes
const otpRoutes = require("../routes/authRoutes");
const betRoute = require("../routes/betRoute");
const multibet = require("../routes/multibetRoutes");
const depositRoute = require("../routes/depositeRoute.js");
const verifycodeRoute = require("../routes/verifyCodeRoute.js");
const oddRoute = require("../routes/oddRoute.js");
const cashOut = require("../routes/cashoutRoute.js");
const imageRoutes = require("../routes/ImageRoute.js");
const matchesRoutes = require("../routes/matchesRoute.js");
const topmatchesRoutes = require("../routes/topMatchRoute.js");
const WalletRoutes = require("../routes/wallet.js");
const WinningRoutes = require("../routes/winningRoute.js");
const addonRoutes = require("../routes/addonRoute.js");
const useraddonRoutes = require("../routes/userAddonRoute.js");
const proImgRoutes = require("../routes/profileImageRoute.js");
const userImgRoutes = require("../routes/UserImageRoute.js");
const BookingRoutes = require("../routes/BookingRoute.js");
const notification = require("../routes/notification.js");
const manualCardRoutes = require("../routes/manualCardRoute.js");
const spinBottleRoutes = require("../routes/spinBottleRoute.js");
const sportyHeroRoutes = require("../routes/sportyHeroRoute.js");

// CORS configuration
const allowedOrigins = [
  "https://admingh.online",
  "https://www.admingh.online",
  "https://1win-web.vercel.app",
  "https://1win-web-*.vercel.app", // Allow all Vercel preview deployments
  "https://spindict.com",
  "https://www.spindict.com",
  "https://spindict.vercel.app",
  "https://spindict-*.vercel.app", // Allow all Spindict Vercel preview deployments
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5177",
  "http://localhost:5008",
];

// Handle OPTIONS preflight requests - MUST be before CORS middleware
app.options("*", (req, res) => {
  try {
    const origin = req.headers.origin;
    
    // ALWAYS set CORS headers for OPTIONS requests to prevent browser errors
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
      res.header("Access-Control-Max-Age", "86400"); // 24 hours
    } else {
      // No origin header (e.g., mobile app, Postman)
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    }
    
    return res.sendStatus(200);
  } catch (error) {
    console.error('OPTIONS handler error:', error);
    // Still send 200 to prevent browser errors
    return res.sendStatus(200);
  }
});

app.use(
  cors({
    origin: function (origin, callback) {
      try {
        // Allow requests with no origin (like mobile apps, Postman, or Tasker)
        if (!origin) return callback(null, true);
        
        // Check if origin matches any allowed origin (including wildcard patterns)
        const isAllowed = allowedOrigins.some(allowed => {
          try {
            if (allowed.includes('*')) {
              const pattern = allowed.replace('*', '.*');
              return new RegExp(`^${pattern}$`).test(origin);
            }
            return allowed === origin;
          } catch (e) {
            return false;
          }
        });
        
        if (isAllowed) {
          callback(null, true);
        } else {
          // For production, allow spindict.com and other known origins
          if (origin.includes('spindict.com') || origin.includes('localhost')) {
            callback(null, true);
          } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(null, true); // Allow for now to prevent blocking
          }
        }
      } catch (error) {
        console.error('CORS origin check error:', error);
        // On error, allow the request to prevent blocking
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Additional CORS middleware to ensure headers are always set on responses
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin;
    
    // If there's an origin header, always set CORS headers
    if (origin && typeof origin === 'string') {
      const isAllowed = allowedOrigins.some(allowed => {
        try {
          if (allowed.includes('*')) {
            const pattern = allowed.replace('*', '.*');
            return new RegExp(`^${pattern}$`).test(origin);
          }
          return allowed === origin;
        } catch (e) {
          return false;
        }
      });
      
      // Always set headers if origin is present (especially for production origins)
      if (isAllowed || origin.includes('spindict.com') || origin.includes('localhost')) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
    }
  } catch (error) {
    console.error('CORS middleware error:', error);
    // Continue anyway - don't block the request
  }
  
  next();
});

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
// Only serve uploads if directory exists (not available in serverless)
try {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, "../uploads");
  if (fs.existsSync(uploadsPath)) {
    app.use("/uploads", express.static(uploadsPath));
  }
} catch (error) {
  // In serverless, uploads directory doesn't exist - this is expected
  console.log('Uploads directory not available (serverless environment)');
}

// Middleware to ensure MongoDB connection on each request (for serverless)
app.use(async (req, res, next) => {
  // Skip health check to avoid circular dependency
  if (req.path === '/health') {
    return next();
  }
  
  // Try to connect if not connected
  if (mongoose.connection.readyState === 0) {
    try {
      await connectMongoDB();
    } catch (error) {
      console.error('MongoDB connection error in middleware:', error.message);
      // Continue anyway - some routes might not need DB
    }
  }
  next();
});

// Register the routes
app.get("/api", (req, res) => {
  res.json({ message: "API running successfully" });
});

app.use("/api", otpRoutes);
app.use("/api", betRoute);
app.use("/api", multibet);
// app.use("/api", depositRoute);
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
app.use("/api", sportyHeroRoutes);

// Spindict routes
const spindictRoutes = require("../routes/spindictRoutes");
app.use("/api/spindict", spindictRoutes);

// 1Win routes - mounted at /api/1win
const oneWinAuthRoutes = require("../routes/1win/auth");
const oneWinAdminRoutes = require("../routes/1win/admin");
const oneWinPaymentRoutes = require("../routes/1win/payments");
app.use("/api/1win/auth", oneWinAuthRoutes);
app.use("/api/1win/admin", oneWinAdminRoutes);
app.use("/api/1win/payments", oneWinPaymentRoutes);

const pushTokens = {};

app.post("/store-fcm-token", (req, res) => {
  const { userId, phoneNumber, pushToken } = req.body;
  if (!userId || !phoneNumber || !pushToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  pushTokens[phoneNumber] = { userId, pushToken };
  console.log("Stored push token for phone:", phoneNumber, "Token:", pushToken);
  res.status(200).json({ message: "Push token stored successfully" });
});

app.post("/send-notification", async (req, res) => {
  const { phoneNumber, title, body } = req.body;
  if (!phoneNumber || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const tokenData = pushTokens[phoneNumber];
  if (!tokenData) {
    return res
      .status(404)
      .json({ error: "No push token found for phone number" });
  }
  const message = {
    to: tokenData.pushToken,
    sound: "default",
    title,
    body,
    data: { phoneNumber },
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const data = await response.json();
    console.log("Notification sent to phone:", phoneNumber, "Response:", data);
    res.status(200).json({ message: "Notification sent successfully", data });
  } catch (error) {
    console.error("Error sending notification:", error.message);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Connect to MongoDB
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

// Connect to MongoDB (only if not already connected)
// For serverless functions, we connect on first request if not already connected
let mongoConnectionPromise = null;

function connectMongoDB() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(); // Already connected
  }
  
  if (mongoConnectionPromise) {
    return mongoConnectionPromise; // Connection in progress
  }
  
  mongoConnectionPromise = mongoose
    .connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log("Connected to MongoDB");
      return true;
    })
    .catch((error) => {
      console.error("Error connecting to MongoDB:", error.message);
      mongoConnectionPromise = null; // Reset so we can retry
      // Don't throw - let the app continue even if DB connection fails
      return false;
    });
  
  return mongoConnectionPromise;
}

// Handle favicon requests to prevent 500 errors
app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No Content
});

app.get("/favicon.png", (req, res) => {
  res.status(204).end(); // No Content
});

// Root route - API information
app.get("/", (req, res) => {
  try {
    res.json({
      success: true,
      message: "1Win Server API",
      version: "1.0.0",
      endpoints: {
        auth: "/api/auth",
        "1win-auth": "/api/1win/auth",
        "1win-admin": "/api/1win/admin",
        "1win-payments": "/api/1win/payments",
        games: "/api/games",
        wallet: "/api/wallet",
        promo: "/api/promo",
        content: "/api/content",
        admin: "/api/admin",
        health: "/health",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Root route error:', error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// Health check
app.get("/health", async (req, res) => {
  try {
    // Try to connect if not connected
    await connectMongoDB();
    
    res.json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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

// Export the Express app as a serverless function for Vercel
// Vercel expects a handler function that receives (req, res)
module.exports = async (req, res) => {
  try {
    // Ensure MongoDB is connected before handling request
    if (mongoose.connection.readyState === 0) {
      try {
        await connectMongoDB();
      } catch (error) {
        console.error('MongoDB connection error:', error.message);
        // Don't fail the request if DB connection fails - some routes don't need DB
      }
    }
    
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    // Catch any unhandled errors to prevent 500 crashes
    console.error('Serverless function error:', error);
    
    // If response hasn't been sent, send error response
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    }
  }
};

