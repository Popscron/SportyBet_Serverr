/**
 * Seed Instant Football matches into the database.
 * Run: node scripts/seedInstantFootballMatches.js
 * Or: npm run seed-instant-football
 */
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Load .env from server root if not already loaded
if (!process.env.MONGO_URL) {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

const InstantFootballMatch = require("../models/InstantFootballMatch");

const SEED_MATCHES = [
  { home: "AST", away: "MCI", homeOdd: "2.66", drawOdd: "2.71", awayOdd: "3.28", markets: "+69", league: "England", order: 0 },
  { home: "BHA", away: "NEW", homeOdd: "2.06", drawOdd: "2.90", awayOdd: "4.57", markets: "+69", league: "England", order: 1 },
  { home: "SUN", away: "BRE", homeOdd: "1.97", drawOdd: "3.07", awayOdd: "4.62", markets: "+69", league: "England", order: 2 },
  { home: "FUL", away: "FOR", homeOdd: "1.96", drawOdd: "2.96", awayOdd: "4.97", markets: "+69", league: "England", order: 3 },
  { home: "EVE", away: "CHE", homeOdd: "3.37", drawOdd: "2.75", awayOdd: "2.57", markets: "+69", league: "England", order: 4 },
  { home: "MUN", away: "LIV", homeOdd: "2.68", drawOdd: "2.91", awayOdd: "3.00", markets: "+69", league: "England", order: 5 },
];

const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || "mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win";

async function seed() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB");

    const existing = await InstantFootballMatch.countDocuments();
    if (existing > 0) {
      console.log(`Found ${existing} existing match(es). Deleting before seed...`);
      await InstantFootballMatch.deleteMany({});
    }

    const inserted = await InstantFootballMatch.insertMany(SEED_MATCHES);
    console.log(`Seeded ${inserted.length} Instant Football matches.`);
    inserted.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.home} vs ${m.away} (${m.homeOdd} / ${m.drawOdd} / ${m.awayOdd})`);
    });
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

seed();
