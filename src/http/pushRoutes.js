const express = require("express");

const pushTokens = new Map();

// Cleanup tokens older than 30 days (hourly check)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pushTokens) {
    if (now - val.storedAt > 30 * 24 * 60 * 60 * 1000) pushTokens.delete(key);
  }
}, 60 * 60 * 1000);

const router = express.Router();

router.post("/store-fcm-token", (req, res) => {
  const { userId, phoneNumber, pushToken } = req.body;
  if (!userId || !phoneNumber || !pushToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  pushTokens.set(phoneNumber, { userId, pushToken, storedAt: Date.now() });
  res.status(200).json({ message: "Push token stored successfully" });
});

router.post("/send-notification", async (req, res) => {
  const { phoneNumber, title, body } = req.body;
  if (!phoneNumber || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const tokenData = pushTokens.get(phoneNumber);
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
    res.status(200).json({ message: "Notification sent successfully", data });
  } catch (error) {
    console.error("Error sending notification:", error.message);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

module.exports = router;
