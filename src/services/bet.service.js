const mongoose = require("mongoose");
const Bet = require("../../models/bet");
const Deposit = require("../../models/UserBalance");
const Match = require("../../models/multibets");
const VerifyCode = require("../../models/verifycode");
const TransactionHistory = require("../../models/TransactionHistory");

async function recordBetHistory(betDoc) {
  if (!betDoc?._id || !betDoc.userId) {
    return;
  }

  try {
    await TransactionHistory.findOneAndUpdate(
      { sourceCollection: "Bet", sourceId: betDoc._id },
      {
        userId: betDoc.userId,
        type: "Bets - Real Sport",
        amount: betDoc.stake * -1,
        currencyType: betDoc.currencyType,
        status: betDoc.status || "Completed",
        description: "Bet",
        displayDate: betDoc.date,
        eventDate: betDoc.timestamp || new Date(),
        metadata: {
          betCode: betDoc.betCode,
          odd: betDoc.odd,
          stake: betDoc.stake,
          bookingCode: betDoc.bookingCode,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error("Failed to record bet history entry:", error);
  }
}

function generateBookingCode(length = 6) {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function listAllBets() {
  try {
    const bets = await Bet.find().lean();
    return { status: 200, json: bets };
  } catch (error) {
    console.error("Error fetching all bets:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function listBetsByUser(userId) {
  try {
    const bets = await Bet.find({ userId }).lean();
    return { status: 200, json: bets };
  } catch (error) {
    return { status: 500, json: { error: "Error fetching bets" } };
  }
}

async function getByBookingCode(bookingCode) {
  try {
    const bet = await Bet.findOne({
      bookingCode,
    }).lean();

    if (!bet) {
      return {
        status: 404,
        json: { message: "No bet found with this booking code" },
      };
    }

    return { status: 200, json: bet };
  } catch (error) {
    console.error("Error fetching bet:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function createBet(body) {
  try {
    const { userId, date, betCode, stake, odd } = body;

    if (!userId || !date || !betCode || !stake) {
      return { status: 400, json: { error: "All fields are required" } };
    }

    if (isNaN(stake) || stake <= 0) {
      return { status: 400, json: { error: "Invalid stake value" } };
    }

    const deposit = await Deposit.findOne({ userId });

    if (!deposit || deposit.amount < stake) {
      return { status: 400, json: { message: "Insufficient balance" } };
    }

    deposit.amount -= stake;
    await deposit.save();

    const bookingCode = generateBookingCode();

    const newBet = new Bet({ userId, date, betCode, stake, odd, bookingCode });
    const savedBet = await newBet.save();

    await recordBetHistory(savedBet);

    return { status: 201, json: savedBet };
  } catch (error) {
    console.error("Error adding bet:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function createBet1(body) {
  try {
    const { userId, date, stake, odd, bookingCode } = body;

    if (!userId || !date || !bookingCode || !stake) {
      return { status: 400, json: { error: "All fields are required" } };
    }

    const normalizedBookingCode = String(bookingCode).trim();
    const normalizedDate = String(date).trim();

    // Idempotency (per user): if the same bookingCode is retried, return existing bet.
    // NOTE: We don't make bookingCode globally unique across users.
    const existingBet = await Bet.findOne({
      userId,
      bookingCode: normalizedBookingCode,
    }).lean();

    if (existingBet) {
      // Update fields from the retry payload so UI/behavior stays consistent.
      // (We intentionally keep the same betCode and bookingCode.)
      const updatedBet = await Bet.findOneAndUpdate(
        { userId, bookingCode: normalizedBookingCode },
        { $set: { date: normalizedDate, stake, odd } },
        { new: true }
      );

      return { status: 201, json: updatedBet };
    }

    const betCode = generateBookingCode(6);

    const newBet = new Bet({
      userId,
      date: normalizedDate,
      betCode,
      stake,
      odd,
      bookingCode: normalizedBookingCode,
    });
    const savedBet = await newBet.save();

    await recordBetHistory(savedBet);

    return { status: 201, json: savedBet };
  } catch (error) {
    console.error("Error adding bet:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function updateBetOdd(betId, body) {
  try {
    const { odd } = body;

    if (!odd || isNaN(odd) || odd <= 0) {
      return { status: 400, json: { error: "Invalid odd value" } };
    }

    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: { odd } },
      { new: true }
    );

    if (!updatedBet) {
      return { status: 404, json: { error: "Bet not found" } };
    }

    await VerifyCode.deleteOne({ betId });

    await recordBetHistory(updatedBet);

    return { status: 200, json: updatedBet };
  } catch (error) {
    console.error("Error updating bet odd:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function updateTicketFields(betId, body) {
  try {
    const { betCode, date, stake, percentage } = body;

    if (!mongoose.Types.ObjectId.isValid(betId)) {
      return { status: 400, json: { error: "Invalid betId" } };
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return { status: 404, json: { error: "Bet not found" } };
    }

    const updateFields = {};

    if (betCode !== undefined) {
      if (typeof betCode !== "string" || betCode.trim() === "") {
        return { status: 400, json: { error: "Invalid betCode value" } };
      }
      updateFields.betCode = betCode.trim();
    }

    if (date !== undefined) {
      if (
        typeof date !== "string" ||
        !/^\d{2}\/\d{2}, \d{2}:\d{2}$/.test(date)
      ) {
        return {
          status: 400,
          json: {
            error: "Invalid date format. Expected DD/MM, HH:mm",
          },
        };
      }
      updateFields.date = date;
    }

    if (stake !== undefined) {
      const newStake = parseFloat(stake);
      if (isNaN(newStake) || newStake <= 0) {
        return { status: 400, json: { error: "Invalid stake value" } };
      }

      const deposit = await Deposit.findOne({ userId: bet.userId });
      if (!deposit) {
        return {
          status: 400,
          json: { error: "Deposit record not found for user" },
        };
      }

      const stakeDifference = newStake - bet.stake;

      if (stakeDifference > 0 && deposit.amount < stakeDifference) {
        return {
          status: 400,
          json: { error: "Insufficient balance to increase stake" },
        };
      }

      deposit.amount -= stakeDifference;
      await deposit.save();

      updateFields.stake = newStake;
    }

    if (percentage !== undefined) {
      const newPercentage = parseFloat(percentage);
      if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
        return {
          status: 400,
          json: {
            error: "Percentage must be a number between 0 and 100",
          },
        };
      }
      updateFields.percentage = newPercentage;
    }

    await VerifyCode.deleteOne({ betId });

    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: updateFields },
      { new: true }
    );

    await recordBetHistory(updatedBet);

    return { status: 200, json: updatedBet };
  } catch (error) {
    console.error("Error updating bet:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function updateBookingCode(betId, body) {
  try {
    const { bookingCode } = body;

    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: { bookingCode } },
      { new: true }
    );

    if (!updatedBet) {
      return { status: 404, json: { error: "Bet not found" } };
    }
    await VerifyCode.deleteOne({ betId });

    await recordBetHistory(updatedBet);

    return { status: 200, json: updatedBet };
  } catch (error) {
    console.error("Error updating bet odd:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function deleteBet(betIdParam) {
  try {
    const trimmed = String(betIdParam || "").trim();
    if (!trimmed) {
      return { status: 400, json: { error: "Bet ID is required" } };
    }

    const bet = await Bet.findById(trimmed);
    if (!bet) {
      return { status: 404, json: { error: "Bet not found" } };
    }

    const betId = bet._id;

    const deposit = await Deposit.findOne({ userId: bet.userId });
    if (deposit) {
      deposit.amount += bet.stake;
      await deposit.save();
    }

    await Match.deleteMany({ userId: betId });
    await Bet.findByIdAndDelete(betId);
    await VerifyCode.deleteOne({ betId: String(betId) });

    const sourceIdQuery = mongoose.Types.ObjectId.isValid(trimmed)
      ? { sourceCollection: "Bet", sourceId: betId }
      : { sourceCollection: "Bet", sourceId: trimmed };
    await TransactionHistory.deleteOne(sourceIdQuery);

    return {
      status: 200,
      json: { message: "Bet and related matches deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting bet:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

async function deleteAllBetsForUser(userId) {
  try {
    const userBets = await Bet.find({ userId }).select('_id').lean();

    if (!userBets.length) {
      return {
        status: 404,
        json: { message: "No bets found for this user." },
      };
    }

    // Batch delete all matches for all bets at once instead of looping
    const betIds = userBets.map((b) => b._id);
    await Match.deleteMany({ betId: { $in: betIds } });

    await Bet.deleteMany({ userId });
    await TransactionHistory.deleteMany({
      sourceCollection: "Bet",
      userId,
    });

    return {
      status: 200,
      json: {
        message: `All bets and related matches for user ${userId} deleted successfully.`,
      },
    };
  } catch (error) {
    console.error("Error deleting user bets:", error.message);
    return {
      status: 500,
      json: { error: "Internal server error", details: error.message },
    };
  }
}

module.exports = {
  listAllBets,
  listBetsByUser,
  getByBookingCode,
  createBet,
  createBet1,
  updateBetOdd,
  updateTicketFields,
  updateBookingCode,
  deleteBet,
  deleteAllBetsForUser,
};
