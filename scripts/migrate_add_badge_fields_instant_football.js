/**
 * One-time migration to backfill new badge URL fields on existing
 * InstantFootballMatch documents.
 *
 * This does NOT drop or change any existing data – it simply ensures that
 * every document has `homeBadgeUrl` and `awayBadgeUrl` keys, using empty
 * strings by default.
 *
 * Run from the SportyBet_Serverr folder:
 *   node scripts/migrate_add_badge_fields_instant_football.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Load .env from server root if not already loaded
if (!process.env.MONGO_URL && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

const InstantFootballMatch = require("../models/InstantFootballMatch");

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  "mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win";

async function migrate() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB");

    // Only touch documents that don't already have these fields set
    const result = await InstantFootballMatch.updateMany(
      {
        $or: [
          { homeBadgeUrl: { $exists: false } },
          { awayBadgeUrl: { $exists: false } },
        ],
      },
      {
        $set: {
          homeBadgeUrl: "",
          awayBadgeUrl: "",
        },
      }
    );

    console.log(
      `Migration complete. Matched ${result.matchedCount || result.n} document(s), ` +
        `modified ${result.modifiedCount || result.nModified} document(s).`
    );
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

migrate();

