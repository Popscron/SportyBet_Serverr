const mongoose = require("mongoose");

// Every team code an admin has ever entered for a league (via create/update of
// an InstantFootballMatch), so the app can reshuffle matches using a much
// bigger pool than whatever matches happen to be active right now - even
// after the specific match that introduced a team is edited or deleted.
const instantFootballTeamSchema = new mongoose.Schema(
  {
    league: { type: String, required: true },
    code: { type: String, required: true },
    badgeUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

instantFootballTeamSchema.index({ league: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("InstantFootballTeam", instantFootballTeamSchema);
