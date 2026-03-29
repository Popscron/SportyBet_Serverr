const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
  matchId: Number,
  time: String,
  league: String,
  homeTeam: String,
  awayTeam: String,
  homeOdd: String,
  drawOdd: String,
  awayOdd: String,
  points: String,
  isLive: { type: Boolean, default: false },
  hot:{type: Boolean, default : true},
  bestOdd:{type: Boolean, default : true},
});

MatchSchema.index({ isLive: 1, time: 1 });

module.exports = mongoose.model("Match", MatchSchema);
