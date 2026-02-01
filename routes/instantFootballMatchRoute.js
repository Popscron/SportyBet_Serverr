const express = require("express");
const router = express.Router();
const InstantFootballMatch = require("../models/InstantFootballMatch");

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
    }));
    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching instant football matches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /instant-football/matches - admin add match (e.g. from Sporty website)
router.post("/instant-football/matches", async (req, res) => {
  try {
    const { home, away, homeOdd, drawOdd, awayOdd, markets, league, order } = req.body;
    if (!home || !away) {
      return res.status(400).json({ success: false, error: "home and away are required" });
    }
    const count = await InstantFootballMatch.countDocuments();
    const match = new InstantFootballMatch({
      home: String(home).trim(),
      away: String(away).trim(),
      homeOdd: homeOdd != null ? String(homeOdd) : "2.00",
      drawOdd: drawOdd != null ? String(drawOdd) : "3.00",
      awayOdd: awayOdd != null ? String(awayOdd) : "3.50",
      markets: markets != null ? String(markets) : "+69",
      league: league != null ? String(league) : "England",
      order: order != null ? Number(order) : count,
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
    ["home", "away", "homeOdd", "drawOdd", "awayOdd", "markets", "league", "order"].forEach((key) => {
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

// DELETE /instant-football/matches/:id - remove match
router.delete("/instant-football/matches/:id", async (req, res) => {
  try {
    const match = await InstantFootballMatch.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });
    res.status(200).json({ success: true, message: "Match deleted" });
  } catch (error) {
    console.error("Error deleting instant football match:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
