/**
 * Migrate VirtualGameBet: add new per-match fields (won, status, outcome) to existing documents.
 * Run once after deploying the updated VirtualGameBet schema.
 *
 * Run: node scripts/migrateVirtualGameBetFields.js
 * Or:  npm run migrate-virtual-game-bet
 */
require("dotenv").config();
const path = require("path");

if (!process.env.MONGO_URL) {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

const mongoose = require("mongoose");
const VirtualGameBet = require("../models/VirtualGameBet");

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/your_db";

async function migrate() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB\n");

    const docs = await VirtualGameBet.find({}).lean();
    console.log(`Found ${docs.length} VirtualGameBet document(s).`);

    let updated = 0;
    for (const doc of docs) {
      if (!doc.matches || !Array.isArray(doc.matches) || doc.matches.length === 0) {
        continue;
      }

      const matches = doc.matches.map((m) => ({
        ...m,
        won: m.won !== undefined ? m.won : null,
        status: m.status !== undefined ? m.status : "",
        outcome: m.outcome !== undefined ? m.outcome : "",
      }));

      await VirtualGameBet.updateOne(
        { _id: doc._id },
        { $set: { matches, updatedAt: new Date() } }
      );
      updated++;
      console.log(`  Updated bet: ticketId=${doc.ticketId}`);
    }

    console.log(`\nDone. Migrated ${updated} document(s).`);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

migrate();
