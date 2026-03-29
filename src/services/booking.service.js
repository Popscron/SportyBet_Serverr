const BetModel = require("../../models/bet");
const BookingModel = require("../../models/BookingCode");
const MultBet = require("../../models/multibets");
const UserBalance = require("../../models/UserBalance");
const CashOutModel = require("../../models/cashOut");

function formatDate(date) {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}, ${hours}:${minutes}`;
}

function formatOneDayAgo() {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const day = String(oneDayAgo.getDate()).padStart(2, "0");
  const month = String(oneDayAgo.getMonth() + 1).padStart(2, "0");
  const hours = String(oneDayAgo.getHours()).padStart(2, "0");
  const minutes = String(oneDayAgo.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hours}:${minutes}`;
}

function generateNumericCode(length = 6) {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function place(body) {
  const { betId, stake, userId, deviceTime, deviceTimestamp } = body;

  if (!betId || !stake || stake <= 0 || !userId) {
    return { status: 400, json: { message: "Invalid input" } };
  }

  try {
    const userBalance = await UserBalance.findOne({ userId });
    if (!userBalance || userBalance.amount < stake) {
      return {
        status: 400,
        json: {
          message: "Insufficient balance",
          balance: userBalance?.amount || 0,
        },
      };
    }

    userBalance.amount -= stake;
    await userBalance.save();
    let bet = await BetModel.findById(betId);

    if (!bet) {
      return { status: 404, json: { message: "Bet not found" } };
    }

    let updatedBet;
    let message = "Bet placed successfully. Matches updated.";
    const currentTime = deviceTime || formatDate(new Date());
    const betTimestamp = deviceTimestamp
      ? new Date(deviceTimestamp)
      : new Date();

    if (bet.userId.toString() !== userId) {
      const newBet = new BetModel({
        userId,
        betCode: bet.betCode,
        date: currentTime,
        odd: bet.odd,
        bookingCode: bet.bookingCode,
        percentage: bet.percentage,
        stake,
        timestamp: betTimestamp,
      });
      await newBet.save();

      const newBetId = newBet._id;

      const originalMatches = await MultBet.find({ userId: betId });
      const newMatches = originalMatches.map((match) => ({
        ...match.toObject(),
        _id: undefined,
        userId: newBetId,
        userId1: userId,
        status: "Not Started",
      }));

      if (newMatches.length > 0) {
        await MultBet.insertMany(newMatches);
      }

      const newBooking = new BookingModel({ betId: newBetId });
      await newBooking.save();

      updatedBet = newBet;
      message = "Bet copied and placed successfully in your account. Matches added.";
    } else {
      updatedBet = await BetModel.findByIdAndUpdate(
        betId,
        {
          stake,
          date: currentTime,
          timestamp: betTimestamp,
        },
        { new: true }
      );

      await MultBet.updateMany(
        { userId: betId },
        { $set: { status: "Not Started" } }
      );

      const existingBooking = await BookingModel.findOne({ betId });
      if (!existingBooking) {
        const newBooking = new BookingModel({ betId });
        await newBooking.save();
      }
    }

    return {
      status: 200,
      json: {
        message,
        bet: updatedBet,
        balance: userBalance.amount,
      },
    };
  } catch (err) {
    console.error("Error placing bet:", err);
    return { status: 500, json: { message: "Internal server error" } };
  }
}

async function placeFromCollapsed(body) {
  const {
    userId,
    stake,
    matches,
    totalOdd,
    bookingCode,
    deviceTime,
    deviceTimestamp,
    isVirtualGame,
  } = body;

  if (!userId || !stake || stake <= 0) {
    return {
      status: 400,
      json: { message: "Invalid input: userId and stake are required" },
    };
  }

  if (isVirtualGame === true) {
    try {
      const userBalance = await UserBalance.findOne({ userId });
      if (!userBalance || userBalance.amount < stake) {
        return {
          status: 400,
          json: {
            message: "Insufficient balance",
            balance: userBalance?.amount || 0,
          },
        };
      }
      userBalance.amount -= stake;
      await userBalance.save();
      return {
        status: 200,
        json: {
          message: "Virtual game bet – balance deducted",
          balance: userBalance.amount,
        },
      };
    } catch (err) {
      console.error("Error placing virtual game bet (balance deduct):", err);
      return {
        status: 500,
        json: { message: "Internal server error", error: err.message },
      };
    }
  }

  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return { status: 400, json: { message: "Matches array is required" } };
  }

  try {
    const userBalance = await UserBalance.findOne({ userId });
    if (!userBalance || userBalance.amount < stake) {
      return {
        status: 400,
        json: {
          message: "Insufficient balance",
          balance: userBalance?.amount || 0,
        },
      };
    }

    userBalance.amount -= stake;
    await userBalance.save();

    const betCode = generateNumericCode(6);
    const finalBookingCode = bookingCode || generateNumericCode(6);
    const currentTime = deviceTime || formatDate(new Date());
    const betTimestamp = deviceTimestamp
      ? new Date(deviceTimestamp)
      : new Date();

    const calculatedOdd =
      totalOdd ||
      matches
        .reduce((acc, match) => acc * parseFloat(match.odd || 1), 1)
        .toFixed(2);

    const newBet = new BetModel({
      userId,
      betCode,
      date: currentTime,
      odd: calculatedOdd.toString(),
      bookingCode: finalBookingCode,
      stake,
      percentage: 10,
      timestamp: betTimestamp,
    });
    const savedBet = await newBet.save();

    const matchesToInsert = matches.map((match) => {
      const teamsValue = match.team || match.teams || "N/A";
      const marketValue =
        match.marketType || match.market || match.type || "N/A";
      const sportTypeValue = match.sportType || "Football";

      return {
        userId: savedBet._id,
        userId1: userId,
        gameId: match.gameId || null,
        dateTime: formatOneDayAgo(),
        teams: teamsValue,
        ftScore: match.ftScore || "N/A",
        pick: match.pick || "N/A",
        market: marketValue,
        outcome: match.pick || match.outcome || "N/A",
        odd: (match.odd || 1.0).toString(),
        status: "Not Started",
        type: sportTypeValue,
        chatNumber: Math.floor(Math.random() * 100) + 1,
      };
    });

    if (matchesToInsert.length > 0) {
      await MultBet.insertMany(matchesToInsert);
    }

    const newBooking = new BookingModel({ betId: savedBet._id });
    await newBooking.save();

    await CashOutModel.create({
      betId: savedBet._id,
      amount: 0,
      cashoutStatus: "cashout",
    });

    return {
      status: 200,
      json: {
        message: "Bet placed successfully from collapsed modal",
        bet: savedBet,
        balance: userBalance.amount,
      },
    };
  } catch (err) {
    console.error("Error placing bet from collapsed modal:", err);
    return {
      status: 500,
      json: { message: "Internal server error", error: err.message },
    };
  }
}

module.exports = {
  place,
  placeFromCollapsed,
};
