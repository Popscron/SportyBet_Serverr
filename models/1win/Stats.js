const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    playedToday: {
      type: Number,
      default: 1344,
      required: true,
    },
    totalPlayed: {
      type: Number,
      default: 24834,
      required: true,
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one stats document exists
statsSchema.statics.getStats = async function () {
  let stats = await this.findOne();
  if (!stats) {
    stats = await this.create({
      playedToday: 1344,
      totalPlayed: 24834,
      lastUpdate: new Date(),
    });
  }
  return stats;
};

// Update stats if 24 hours have passed
statsSchema.statics.checkAndUpdate = async function () {
  const stats = await this.getStats();
  const now = new Date();
  const hoursSinceUpdate = (now - stats.lastUpdate) / (1000 * 60 * 60);

  if (hoursSinceUpdate >= 24) {
    const periodsPassed = Math.floor(hoursSinceUpdate / 24);
    const increment = periodsPassed * 10;

    stats.playedToday += increment;
    stats.totalPlayed += increment;
    stats.lastUpdate = now;
    await stats.save();

    return stats;
  }

  return stats;
};

module.exports = mongoose.model('1WinStats', statsSchema);
