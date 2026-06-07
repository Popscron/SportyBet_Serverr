/**
 * Backfill score fields on VirtualGameBet documents created before HT/FT modal fields existed.
 * Adds per-match halfTimeScoreA/B, ht, ft, htSeq, ftSeq and root ht/ft where missing.
 *
 * Run: node scripts/migrateVirtualGameBetScoreFields.js
 * Or:  npm run migrate-virtual-game-bet-scores
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

function toScoreNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseScorePair(str) {
  if (str == null || str === "") return null;
  const m = String(str).trim().match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}

function normalizeMatch(m, root) {
  const ftPair = parseScorePair(m?.ft);
  const htPair = parseScorePair(m?.ht);
  const scoreA =
    toScoreNum(m?.scoreA) ??
    ftPair?.a ??
    (root ? toScoreNum(root.scoreA) : null);
  const scoreB =
    toScoreNum(m?.scoreB) ??
    ftPair?.b ??
    (root ? toScoreNum(root.scoreB) : null);
  const halfTimeScoreA =
    toScoreNum(m?.halfTimeScoreA) ??
    htPair?.a ??
    (root ? toScoreNum(root.halfTimeScoreA) : null);
  const halfTimeScoreB =
    toScoreNum(m?.halfTimeScoreB) ??
    htPair?.b ??
    (root ? toScoreNum(root.halfTimeScoreB) : null);
  const ft =
    m?.ft != null && String(m.ft).trim() !== ""
      ? String(m.ft).trim()
      : scoreA != null && scoreB != null
        ? `${scoreA} - ${scoreB}`
        : "";
  const ht =
    m?.ht != null && String(m.ht).trim() !== ""
      ? String(m.ht).trim()
      : halfTimeScoreA != null && halfTimeScoreB != null
        ? `${halfTimeScoreA}-${halfTimeScoreB}`
        : "";

  return {
    ...m,
    scoreA,
    scoreB,
    halfTimeScoreA,
    halfTimeScoreB,
    ft,
    ht,
    htSeq: m?.htSeq ?? m?.htSequence ?? "",
    ftSeq: m?.ftSeq ?? m?.ftSequence ?? "",
    won: m?.won !== undefined ? m.won : null,
    status: m?.status !== undefined ? m.status : "",
    outcome: m?.outcome !== undefined ? m.outcome : "",
  };
}

async function migrate() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB\n");

    const docs = await VirtualGameBet.find({}).lean();
    console.log(`Found ${docs.length} VirtualGameBet document(s).`);

    let updated = 0;
    for (const doc of docs) {
      const matches = Array.isArray(doc.matches) ? doc.matches : [];
      const root = {
        scoreA: doc.scoreA,
        scoreB: doc.scoreB,
        halfTimeScoreA: doc.halfTimeScoreA,
        halfTimeScoreB: doc.halfTimeScoreB,
        ft: doc.ft,
        ht: doc.ht,
      };

      const nextMatches =
        matches.length > 0
          ? matches.map((m, i) => normalizeMatch(m, i === 0 ? root : null))
          : [];

      const m0 = nextMatches[0];
      const scoreA = toScoreNum(doc.scoreA) ?? m0?.scoreA ?? null;
      const scoreB = toScoreNum(doc.scoreB) ?? m0?.scoreB ?? null;
      const halfTimeScoreA =
        toScoreNum(doc.halfTimeScoreA) ?? m0?.halfTimeScoreA ?? null;
      const halfTimeScoreB =
        toScoreNum(doc.halfTimeScoreB) ?? m0?.halfTimeScoreB ?? null;
      const ft =
        doc.ft != null && String(doc.ft).trim() !== ""
          ? String(doc.ft).trim()
          : m0?.ft ||
            (scoreA != null && scoreB != null ? `${scoreA} - ${scoreB}` : "");
      const ht =
        doc.ht != null && String(doc.ht).trim() !== ""
          ? String(doc.ht).trim()
          : m0?.ht ||
            (halfTimeScoreA != null && halfTimeScoreB != null
              ? `${halfTimeScoreA}-${halfTimeScoreB}`
              : "");

      await VirtualGameBet.updateOne(
        { _id: doc._id },
        {
          $set: {
            scoreA,
            scoreB,
            halfTimeScoreA,
            halfTimeScoreB,
            ft,
            ht,
            matches: nextMatches,
            updatedAt: new Date(),
          },
        }
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
