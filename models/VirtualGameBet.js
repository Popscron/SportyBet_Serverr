const mongoose = require("mongoose");

const VirtualGameBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  bookingCode: {
    type: String,
    required: true,
  },
  stake: {
    type: Number,
    required: true,
    min: 0.1,
  },
  totalOdds: {
    type: Number,
    required: true,
    default: 1.0,
  },
  potentialWin: {
    type: Number,
    default: 0,
  },
  // For manual/virtual update mode outcome display (separate from Pick)
  outcome: {
    type: String,
    default: "",
  },
  totalReturn: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["Pending", "Won", "Lost"],
    default: "Pending",
    index: true,
  },
  matches: [{
    home: String,
    away: String,
    team: String, // Full team name string like "BRE vs BOU"
    pick: String, // Home, Draw, Away
    market: String, // 1X2, O/U, etc.
    odd: String,
    matchId: String,
  }],
  // Game result data
  scoreA: {
    type: Number,
    default: null,
  },
  scoreB: {
    type: Number,
    default: null,
  },
  halfTimeScoreA: {
    type: Number,
    default: null,
  },
  halfTimeScoreB: {
    type: Number,
    default: null,
  },
  matchHome: String,
  matchAway: String,
  betPick: String, // Home, Draw, Away
  market: {
    type: String,
    default: "1X2",
  },
  currencyType: {
    type: String,
    default: "GHS",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
VirtualGameBetSchema.index({ userId: 1, createdAt: -1 });
VirtualGameBetSchema.index({ userId: 1, status: 1 });
VirtualGameBetSchema.index({ ticketId: 1 });

// Update the updatedAt field before saving
VirtualGameBetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const VirtualGameBet = mongoose.model("VirtualGameBet", VirtualGameBetSchema);

module.exports = VirtualGameBet;
