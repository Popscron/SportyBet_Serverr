const mongoose = require("mongoose");

const instantFootballMatchSchema = new mongoose.Schema({
  home: { type: String, required: true },
  away: { type: String, required: true },
  homeOdd: { type: String, default: "2.00" },
  drawOdd: { type: String, default: "3.00" },
  awayOdd: { type: String, default: "3.50" },
  markets: { type: String, default: "+69" },
  league: { type: String, default: "England" },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("InstantFootballMatch", instantFootballMatchSchema);
