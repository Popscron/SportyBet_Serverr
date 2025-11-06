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
const path = require("path");
const cookieParser = require("cookie-parser");

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  cors({
    origin: [
      "https://admingh.online",
      "https://www.admingh.online",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
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
mongoose
  .connect(process.env.MONGO_URL, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// updated

// test for hiickey
