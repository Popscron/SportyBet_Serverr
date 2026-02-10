const express = require("express");
const router = express.Router();
const InstantFootballMatch = require("../models/InstantFootballMatch");
const upload = require("../middleware/upload"); // multer-based upload (leftLogo/rightLogo)
const fs = require("fs");
const path = require("path");

// Helper to safely delete a local upload file based on a stored URL
const deleteLocalUploadIfExists = (url) => {
  try {
    if (!url) return;

    let pathname = "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      pathname = parsed.pathname; // e.g. /uploads/filename.png
    } else {
      pathname = url;
    }

    const uploadsIndex = pathname.indexOf("/uploads/");
    if (uploadsIndex === -1) return;

    const relativePath = pathname.slice(uploadsIndex + "/uploads/".length);
    if (!relativePath) return;

    const filePath = path.join(__dirname, "..", "uploads", relativePath);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn("Failed to delete upload file:", filePath, err.message);
      }
    });
  } catch (err) {
    console.warn("Error while trying to delete upload file:", err.message);
  }
};

// GET /instant-football/matches - for app (list all matches, sorted by order)
router.get("/instant-football/matches", async (req, res) => {
  try {
    const matches = await InstantFootballMatch.find()
      .sort({ order: 1, createdAt: 1 })
      .lean();
    const formatted = matches.map((m, i) => ({
      id: String(m._id),
      home: m.home,
      away: m.away,
      homeOdd: m.homeOdd || "2.00",
      drawOdd: m.drawOdd || "3.00",
      awayOdd: m.awayOdd || "3.50",
      markets: m.markets || "+69",
      league: m.league || "England",
      order: m.order != null ? m.order : i,
      homeBadgeUrl: m.homeBadgeUrl || "",
      awayBadgeUrl: m.awayBadgeUrl || "",
    }));
    // Debug: log what we are sending to the app
    console.log("instant-football/matches GET - returning matches:", formatted);
    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching instant football matches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /instant-football/matches - admin add match (e.g. from Sporty website)
// Uses multipart/form-data so admin can upload home/away badges directly.
// Reuses generic upload middleware that accepts `leftLogo` and `rightLogo` fields.
router.post("/instant-football/matches", upload, async (req, res) => {
  try {
    const {
      home,
      away,
      homeOdd,
      drawOdd,
      awayOdd,
      markets,
      league,
      order,
    } = req.body;
    if (!home || !away) {
      return res.status(400).json({ success: false, error: "home and away are required" });
    }
    const count = await InstantFootballMatch.countDocuments();

    // If files were uploaded, derive URL paths from them.
    // We only store a relative path (/uploads/filename) and let the mobile app
    // prepend API_BASE_URL so the host/IP always matches what the app uses.
    const uploadedHome =
      req.files && req.files.leftLogo && req.files.leftLogo[0]
        ? `/uploads/${req.files.leftLogo[0].filename}`
        : "";
    const uploadedAway =
      req.files && req.files.rightLogo && req.files.rightLogo[0]
        ? `/uploads/${req.files.rightLogo[0].filename}`
        : "";
    const match = new InstantFootballMatch({
      home: String(home).trim(),
      away: String(away).trim(),
      homeOdd: homeOdd != null ? String(homeOdd) : "2.00",
      drawOdd: drawOdd != null ? String(drawOdd) : "3.00",
      awayOdd: awayOdd != null ? String(awayOdd) : "3.50",
      markets: markets != null ? String(markets) : "+69",
      league: league != null ? String(league) : "England",
      order: order != null ? Number(order) : count,
      // Prefer uploaded images; fall back to URLs from body if provided.
      homeBadgeUrl:
        uploadedHome ||
        (req.body.homeBadgeUrl ? String(req.body.homeBadgeUrl).trim() : ""),
      awayBadgeUrl:
        uploadedAway ||
        (req.body.awayBadgeUrl ? String(req.body.awayBadgeUrl).trim() : ""),
    });
    await match.save();
    res.status(201).json({
      success: true,
      data: {
        id: String(match._id),
        home: match.home,
        away: match.away,
        homeOdd: match.homeOdd,
        drawOdd: match.drawOdd,
        awayOdd: match.awayOdd,
        markets: match.markets,
        league: match.league,
        order: match.order,
        homeBadgeUrl: match.homeBadgeUrl || "",
        awayBadgeUrl: match.awayBadgeUrl || "",
      },
    });
  } catch (error) {
    console.error("Error adding instant football match:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /instant-football/matches/:id - update match
router.put("/instant-football/matches/:id", async (req, res) => {
  try {
    const updates = {};
    [
      "home",
      "away",
      "homeOdd",
      "drawOdd",
      "awayOdd",
      "markets",
      "league",
      "order",
      "homeBadgeUrl",
      "awayBadgeUrl",
    ].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    const match = await InstantFootballMatch.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });
    res.status(200).json({ success: true, data: match });
  } catch (error) {
    console.error("Error updating instant football match:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /instant-football/matches/:id - remove match (+ associated badge files)
router.delete("/instant-football/matches/:id", async (req, res) => {
  try {
    const match = await InstantFootballMatch.findByIdAndDelete(req.params.id);
    if (!match)
      return res
        .status(404)
        .json({ success: false, error: "Match not found" });

    // Best-effort deletion of local upload files for badges
    deleteLocalUploadIfExists(match.homeBadgeUrl);
    deleteLocalUploadIfExists(match.awayBadgeUrl);

    res.status(200).json({ success: true, message: "Match deleted" });
  } catch (error) {
    console.error("Error deleting instant football match:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
