const Match = require("../../models/Match");

async function saveManyMatches(body) {
  try {
    const matches = body.matches;

    if (!Array.isArray(matches) || matches.length === 0) {
      return { status: 400, json: { message: "No matches provided" } };
    }

    const formattedMatches = matches.map((match) => ({
      matchId: Math.floor(Math.random() * 100000),
      time: match.time,
      league: match.league,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeOdd: match.homeOdd || "",
      drawOdd: match.drawOdd || "",
      awayOdd: match.awayOdd || "",
      points: match.points || "",
      isLive: match.isLive || false,
    }));

    const savedMatches = await Match.insertMany(formattedMatches);
    return { status: 201, json: savedMatches };
  } catch (error) {
    console.error("Error saving matches:", error);
    return { status: 500, json: { error: "Failed to save matches" } };
  }
}

async function createSingleMatch(body) {
  try {
    const {
      league,
      isLive,
      time,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      homeOdd,
      drawOdd,
      awayOdd,
      points,
    } = body;

    const match = new Match({
      league,
      time,
      isLive: isLive || false,
      homeScore: homeScore || "0",
      awayScore: awayScore || "0",
      points: points || "0",
      homeTeam,
      awayTeam,
      homeOdd,
      drawOdd,
      awayOdd,
      hot: true,
      bestOdd: true,
    });

    await match.save();
    return { status: 201, json: match };
  } catch (error) {
    console.error("Error creating manual match:", error);
    return {
      status: 500,
      json: {
        message: "Server error creating manual match",
        error: error.message,
      },
    };
  }
}

async function listMatches() {
  try {
    const matches = await Match.find().sort({ time: 1 }).lean();
    return { status: 200, json: matches };
  } catch (error) {
    console.error("Error fetching matches:", error);
    return { status: 500, json: { error: "Failed to fetch matches" } };
  }
}

async function patchMatch(matchId, body) {
  try {
    const updateFields = body;
    console.log(updateFields);

    if (Object.keys(updateFields).length === 0) {
      return { status: 400, json: { message: "No update fields provided" } };
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      matchId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return { status: 404, json: { message: "Match not found" } };
    }

    return { status: 200, json: updatedMatch };
  } catch (error) {
    console.error("Error updating match:", error);
    return { status: 500, json: { error: "Failed to update match" } };
  }
}

async function patchMatchStatus(matchId, body) {
  try {
    const { bestOdd, hot } = body;

    if (typeof bestOdd === "undefined" && typeof hot === "undefined") {
      return { status: 400, json: { message: "No status fields provided" } };
    }

    const updateFields = {};
    if (typeof bestOdd !== "undefined") updateFields.bestOdd = bestOdd;
    if (typeof hot !== "undefined") updateFields.hot = hot;

    const updatedMatch = await Match.findByIdAndUpdate(
      matchId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return { status: 404, json: { message: "Match not found" } };
    }

    return {
      status: 200,
      json: {
        message: "Match status updated successfully",
        match: updatedMatch,
      },
    };
  } catch (error) {
    console.error("Error updating match status:", error);
    return {
      status: 500,
      json: { error: "Failed to update match status" },
    };
  }
}

module.exports = {
  saveManyMatches,
  createSingleMatch,
  listMatches,
  patchMatch,
  patchMatchStatus,
};
