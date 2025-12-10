const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const app = express();
const otpRoutes = require("./routes/authRoutes");
const betRoute = require("./routes/betRoute");
const multibet = require("./routes/multibetRoutes");
const depositRoute = require("./routes/depositeRoute.js");
const verifycodeRoute = require("./routes/verifyCodeRoute.js");
const oddRoute = require("./routes/oddRoute.js");
const cashOut = require("./routes/cashoutRoute.js");
const imageRoutes = require("./routes/ImageRoute.js");
const matchesRoutes = require("./routes/matchesRoute.js");
const topmatchesRoutes = require("./routes/topMatchRoute.js");
const WalletRoutes = require("./routes/wallet.js");
const WinningRoutes = require("./routes/winningRoute.js");
const addonRoutes = require("./routes/addonRoute.js");
const useraddonRoutes = require("./routes/userAddonRoute.js");
const proImgRoutes = require("./routes/profileImageRoute.js");
const userImgRoutes = require("./routes/UserImageRoute.js");
const BookingRoutes = require("./routes/BookingRoute.js");
const notification = require("./routes/notification.js");
const manualCardRoutes = require("./routes/manualCardRoute.js");
const spinBottleRoutes = require("./routes/spinBottleRoute.js");
const path = require("path");
const cookieParser = require("cookie-parser");

// CORS must be configured BEFORE other middleware
// Handle preflight requests first
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://admingh.online",
    "https://www.admingh.online",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  }
  res.sendStatus(200);
});

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "https://admingh.online",
        "https://www.admingh.online",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ];
      
      // Allow requests with no origin (like mobile apps, Postman, or Tasker)
      // Tasker sends requests without an origin header, so this allows them through
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
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

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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

// 1Win routes - mounted at /api/1win
const oneWinAuthRoutes = require("./routes/1win/auth");
const oneWinAdminRoutes = require("./routes/1win/admin");
const oneWinPaymentRoutes = require("./routes/1win/payments");
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

// Connect to MongoDB (replace with your own URI)
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose
  .connect(mongoUrl, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

const PORT = process.env.PORT || 5008;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// updated

// test for hiickey
