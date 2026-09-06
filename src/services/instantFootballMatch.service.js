const fs = require("fs");
const path = require("path");
const InstantFootballMatch = require("../../models/InstantFootballMatch");
const InstantFootballTeam = require("../../models/InstantFootballTeam");

// Record that this team code exists in this league so future reshuffles can
// draw from the full historical roster, not just whatever matches are active
// right now. Never overwrites an existing badge with a blank one.
async function upsertTeam(league, code, badgeUrl) {
  const cleanLeague = String(league || "England").trim();
  const cleanCode = String(code || "").trim();
  if (!cleanCode) return;
  try {
    const update = { league: cleanLeague, code: cleanCode };
    if (badgeUrl) update.badgeUrl = badgeUrl;
    await InstantFootballTeam.findOneAndUpdate(
      { league: cleanLeague, code: cleanCode },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.warn("Failed to upsert instant football team roster entry:", err.message);
  }
}

function deleteLocalUploadIfExists(url) {
  try {
    if (!url) return;

    let pathname = "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      pathname = parsed.pathname;
    } else {
      pathname = url;
    }

    const uploadsIndex = pathname.indexOf("/uploads/");
    if (uploadsIndex === -1) return;

    const relativePath = pathname.slice(uploadsIndex + "/uploads/".length);
    if (!relativePath) return;

    const filePath = path.join(__dirname, "..", "..", "uploads", relativePath);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn("Failed to delete upload file:", filePath, err.message);
      }
    });
  } catch (err) {
    console.warn("Error while trying to delete upload file:", err.message);
  }
}

async function listMatches() {
  try {
    const [matches, teams] = await Promise.all([
      InstantFootballMatch.find().sort({ order: 1, createdAt: 1 }).lean(),
      InstantFootballTeam.find().lean(),
    ]);
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
      homeBadgeUrl: m.homeBadgeUrl || "",
      awayBadgeUrl: m.awayBadgeUrl || "",
    }));

    // Every team code ever added for each league (survives matches being
    // edited/deleted) so the app can reshuffle from a bigger pool than just
    // the currently active matches.
    const teamsByLeague = {};
    teams.forEach((t) => {
      const league = t.league || "England";
      if (!teamsByLeague[league]) teamsByLeague[league] = [];
      teamsByLeague[league].push({ code: t.code, badgeUrl: t.badgeUrl || "" });
    });

    return {
      status: 200,
      json: { success: true, data: formatted, teamsByLeague },
    };
  } catch (error) {
    console.error("Error fetching instant football matches:", error);
    return { status: 500, json: { success: false, error: error.message } };
  }
}

async function createMatch(body, files) {
  try {
    const {
      home,
      away,
      homeOdd,
      drawOdd,
      awayOdd,
      markets,
      league,
      order,
    } = body;
    if (!home || !away) {
      return {
        status: 400,
        json: { success: false, error: "home and away are required" },
      };
    }
    const count = await InstantFootballMatch.countDocuments();

    const uploadedHome =
      files && files.leftLogo && files.leftLogo[0]
        ? `/uploads/${files.leftLogo[0].filename}`
        : "";
    const uploadedAway =
      files && files.rightLogo && files.rightLogo[0]
        ? `/uploads/${files.rightLogo[0].filename}`
        : "";
    const match = new InstantFootballMatch({
      home: String(home).trim(),
      away: String(away).trim(),
      homeOdd: homeOdd != null ? String(homeOdd) : "2.00",
      drawOdd: drawOdd != null ? String(drawOdd) : "3.00",
      awayOdd: awayOdd != null ? String(awayOdd) : "3.50",
      markets: markets != null ? String(markets) : "+69",
      league: league != null ? String(league) : "England",
      order: order != null ? Number(order) : count,
      homeBadgeUrl:
        uploadedHome ||
        (body.homeBadgeUrl ? String(body.homeBadgeUrl).trim() : ""),
      awayBadgeUrl:
        uploadedAway ||
        (body.awayBadgeUrl ? String(body.awayBadgeUrl).trim() : ""),
    });
    await match.save();
    await Promise.all([
      upsertTeam(match.league, match.home, match.homeBadgeUrl),
      upsertTeam(match.league, match.away, match.awayBadgeUrl),
    ]);
    return {
      status: 201,
      json: {
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
          homeBadgeUrl: match.homeBadgeUrl || "",
          awayBadgeUrl: match.awayBadgeUrl || "",
        },
      },
    };
  } catch (error) {
    console.error("Error adding instant football match:", error);
    return { status: 500, json: { success: false, error: error.message } };
  }
}

async function updateMatch(id, body) {
  try {
    const updates = {};
    [
      "home",
      "away",
      "homeOdd",
      "drawOdd",
      "awayOdd",
      "markets",
      "league",
      "order",
      "homeBadgeUrl",
      "awayBadgeUrl",
    ].forEach((key) => {
      if (body[key] !== undefined) updates[key] = body[key];
    });
    const match = await InstantFootballMatch.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!match) {
      return { status: 404, json: { success: false, error: "Match not found" } };
    }
    await Promise.all([
      upsertTeam(match.league, match.home, match.homeBadgeUrl),
      upsertTeam(match.league, match.away, match.awayBadgeUrl),
    ]);
    return { status: 200, json: { success: true, data: match } };
  } catch (error) {
    console.error("Error updating instant football match:", error);
    return { status: 500, json: { success: false, error: error.message } };
  }
}

async function deleteMatch(id) {
  try {
    const match = await InstantFootballMatch.findByIdAndDelete(id);
    if (!match) {
      return { status: 404, json: { success: false, error: "Match not found" } };
    }

    deleteLocalUploadIfExists(match.homeBadgeUrl);
    deleteLocalUploadIfExists(match.awayBadgeUrl);

    return {
      status: 200,
      json: { success: true, message: "Match deleted" },
    };
  } catch (error) {
    console.error("Error deleting instant football match:", error);
    return { status: 500, json: { success: false, error: error.message } };
  }
}

module.exports = {
  listMatches,
  createMatch,
  updateMatch,
  deleteMatch,
};
