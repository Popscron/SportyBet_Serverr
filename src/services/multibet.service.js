const MultBet = require("../../models/multibets");
const BetModel = require("../../models/bet");
const cashout = require("../../models/cashOut");

async function createMultibets(body) {
  try {
    console.log("📩 Received request body:", body);

    const { userId, text, userId1, type } = body;

    if (!userId) {
      return { status: 400, json: { message: "User ID is required" } };
    }

    if (!Array.isArray(text) || text.length === 0) {
      console.error("❌ No valid bets found in request.");
      return { status: 400, json: { message: "No valid bets found." } };
    }

    const cashData = {
      betId: userId,
      amount: 0,
      cashoutStatus: "cashout",
    };

    await cashout.create(cashData);

    const betsToInsert = text.map((bet) => ({
      userId,
      gameId: bet?.gameId || null,
      dateTime: bet?.date || new Date(),
      teams: bet?.teams || "N/A",
      ftScore: bet?.ftScore || "N/A",
      pick: bet?.pick || "N/A",
      market: bet?.market || "N/A",
      outcome: bet?.outcome || "N/A",
      odd: bet?.odd || 1.0,
      createdAt: new Date(),
      type,
      userId1: userId1 || null,
      chatNumber: Math.floor(Math.random() * 100) + 1,
      league: bet?.league || null,
      country: bet?.country || null,
    }));

    const savedBets = await MultBet.insertMany(betsToInsert);

    console.log("✅ Bets successfully stored:", savedBets.length, "bets inserted");

    return {
      status: 200,
      json: {
        message: "Bets stored successfully",
        bets: savedBets,
      },
    };
  } catch (error) {
    console.error("❌ Error processing bets:", error);
    return {
      status: 500,
      json: {
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function addMatch(body) {
  try {
    const { userId, gameId, dateTime, teams, userId1, league, country } = body;

    if (!gameId || !dateTime || !teams) {
      return { status: 400, json: { message: "All fields are required" } };
    }

    const cashData = {
      betId: userId,
      amount: 0,
      cashoutStatus: "cashout",
    };

    const cashExistData = await cashout.findOne({ betId: userId });

    if (cashExistData) {
      await cashout.updateOne({ betId: userId }, { $set: cashData });
    } else {
      await cashout.create(cashData);
    }

    const newMatch = new MultBet({
      userId,
      gameId,
      dateTime,
      teams,
      userId1,
      chatNumber: Math.floor(Math.random() * 100) + 1,
      league: league || null,
      country: country || null,
    });
    await newMatch.save();

    return {
      status: 201,
      json: { message: "Match added successfully", match: newMatch },
    };
  } catch (error) {
    console.error("❌ Error adding match:", error);
    return {
      status: 500,
      json: { message: "Internal server error", error: error.message },
    };
  }
}

async function addMatch1(body) {
  try {
    const {
      userId,
      gameId,
      dateTime,
      teams,
      ftScore = "",
      pick,
      market,
      outcome,
      status,
      odd = "0.1",
      chatNumber = "0",
      type = "Football",
      userId1,
      liveOdd,
      league,
      country,
    } = body;

    if (
      !userId ||
      !gameId ||
      !dateTime ||
      !teams ||
      !pick ||
      !market ||
      !outcome ||
      !status ||
      !userId1
    ) {
      return {
        status: 400,
        json: { message: "All required fields must be provided" },
      };
    }

    const betExists = await BetModel.findById(userId);
    if (!betExists) {
      return { status: 400, json: { message: "Invalid Bet ID" } };
    }

    const validTypes = ["Football", "eFootball", "vFootball"];
    if (!validTypes.includes(type)) {
      return { status: 400, json: { message: "Invalid type value" } };
    }

    const newMatch = new MultBet({
      userId,
      gameId,
      dateTime,
      teams,
      ftScore,
      pick,
      market,
      outcome,
      status,
      odd,
      chatNumber,
      type,
      userId1,
      liveOdd,
      league: league || null,
      country: country || null,
    });
    await newMatch.save();

    const cashData = {
      betId: userId,
      amount: 0,
      cashoutStatus: "cashout",
    };

    const cashExistData = await cashout.findOne({ betId: userId });
    if (cashExistData) {
      await cashout.updateOne({ betId: userId }, { $set: cashData });
    } else {
      await cashout.create(cashData);
    }

    return {
      status: 201,
      json: { message: "Match added successfully", match: newMatch },
    };
  } catch (error) {
    console.error("❌ Error adding match:", error);
    return {
      status: 500,
      json: { message: "Internal server error", error: error.message },
    };
  }
}

async function listByBetUserId(userId) {
  try {
    const bets = await MultBet.find({ userId }).lean();

    if (!bets.length) {
      return {
        status: 404,
        json: { message: "No bets found for this user." },
      };
    }

    return { status: 200, json: bets };
  } catch (error) {
    console.error("Error fetching bets:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function listByRealUserId(userId1) {
  try {
    const bets = await MultBet.find({ userId1 }).lean();

    if (!bets.length) {
      return {
        status: 404,
        json: { message: "No bets found for this user." },
      };
    }

    return { status: 200, json: bets };
  } catch (error) {
    console.error("Error fetching bets:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function updateMultibet(id, body) {
  try {
    const { market, pick, ftScore, outcome, status, odd, userId, chatNumber } =
      body;

    if (!id || !userId) {
      return {
        status: 400,
        json: { message: "Bet ID and User ID are required." },
      };
    }

    const updatedBet = await MultBet.findByIdAndUpdate(
      id,
      { market, pick, ftScore, outcome, status, odd, chatNumber },
      { new: true, runValidators: true }
    );

    if (!updatedBet) {
      return { status: 404, json: { message: "Bet not found." } };
    }

    await BetModel.findByIdAndUpdate(updatedBet.userId, { new: true });

    return { status: 200, json: updatedBet };
  } catch (error) {
    console.error("Error updating bet:", error);
    return {
      status: 500,
      json: { message: "Error updating bet", error: error.message },
    };
  }
}

async function updateMultibetFields(id, body) {
  try {
    const { teams, gameId, dateTime, league, country } = body;

    const updateData = {};
    if (teams !== undefined) updateData.teams = teams;
    if (gameId !== undefined) updateData.gameId = gameId;
    if (dateTime !== undefined) updateData.dateTime = dateTime;
    if (league !== undefined) updateData.league = league;
    if (country !== undefined) updateData.country = country;

    const updatedBet = await MultBet.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedBet) {
      return { status: 404, json: { message: "Bet not found" } };
    }

    return {
      status: 200,
      json: { message: "Bet updated successfully", updatedBet },
    };
  } catch (error) {
    console.error("Error updating bet:", error);
    return {
      status: 500,
      json: { message: "Error updating bet", error },
    };
  }
}

async function updateChat(id, body) {
  try {
    const { chatNumber } = body;

    const updatedBet = await MultBet.findByIdAndUpdate(
      id,
      { chatNumber },
      { new: true }
    );

    if (!updatedBet) {
      return { status: 404, json: { message: "Bet not found" } };
    }

    return {
      status: 200,
      json: { message: "Bet updated successfully", updatedBet },
    };
  } catch (error) {
    console.error("Error updating bet:", error);
    return {
      status: 500,
      json: { message: "Error updating bet", error },
    };
  }
}

async function updateLiveOdd(id, body) {
  try {
    const { liveOdd } = body;

    const oddValue = parseFloat(liveOdd);
    if (isNaN(oddValue) || oddValue <= 0) {
      return { status: 400, json: { message: "Invalid liveOdd value" } };
    }

    const updateResult = await MultBet.updateOne(
      { _id: id },
      { $set: { liveOdd: oddValue } },
      {
        runValidators: false,
        upsert: false,
      }
    );

    if (updateResult.matchedCount === 0) {
      return { status: 404, json: { message: "Bet not found" } };
    }

    return {
      status: 200,
      json: {
        success: true,
        liveOdd: oddValue,
      },
    };
  } catch (error) {
    console.error("Error updating bet:", error);
    return {
      status: 500,
      json: { message: "Error updating bet", error: error.message },
    };
  }
}

module.exports = {
  createMultibets,
  addMatch,
  addMatch1,
  listByBetUserId,
  listByRealUserId,
  updateMultibet,
  updateMultibetFields,
  updateChat,
  updateLiveOdd,
};
