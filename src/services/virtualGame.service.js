const VirtualGameBet = require("../../models/VirtualGameBet");
const Deposit = require("../../models/deposite");
const User = require("../../models/user");

function generateBookingCode25() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const all = lower + upper + digits;

  const chars = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  while (chars.length < 25) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function isValidBookingCode25(code) {
  if (!code) return false;
  const s = String(code).trim();
  if (s.length !== 25) return false;
  if (!/^[A-Za-z0-9]{25}$/.test(s)) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  return true;
}

function isPremiumPlusActive(user) {
  if (!user) return false;
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  return isActive && user.subscription === "Premium Plus";
}

async function checkPremiumPlusAccess(userId) {
  if (!userId) {
    return {
      error: {
        status: 400,
        json: { success: false, error: "userId is required" },
      },
    };
  }
  const user = await User.findById(userId).select("subscription expiry role");
  if (!user) {
    return {
      error: {
        status: 404,
        json: { success: false, error: "User not found" },
      },
    };
  }
  if (user.role === "admin") return { user };
  if (!isPremiumPlusActive(user)) {
    return {
      error: {
        status: 403,
        json: {
          success: false,
          error: "Premium Plus subscription required",
          subscriptionType: user.subscription || "Basic",
        },
      },
    };
  }
  return { user };
}

async function placeBet(body) {
  try {
    const {
      userId,
      ticketId,
      bookingCode,
      stake,
      totalOdds,
      potentialWin,
      matches,
      betPick,
      market,
      currencyType,
    } = body;

    const access = await checkPremiumPlusAccess(userId);
    if (access.error) return access.error;

    if (!userId || !ticketId || stake === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, ticketId, stake",
        },
      };
    }

    const existingBet = await VirtualGameBet.findOne({ ticketId });
    if (existingBet) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Bet with this ticket ID already exists",
        },
      };
    }

    const normalizedBookingCode = isValidBookingCode25(bookingCode)
      ? String(bookingCode).trim()
      : generateBookingCode25();

    const bet = new VirtualGameBet({
      userId,
      ticketId,
      bookingCode: normalizedBookingCode,
      stake: parseFloat(stake),
      totalOdds: parseFloat(totalOdds) || 1.0,
      potentialWin: parseFloat(potentialWin) || 0,
      matches: matches || [],
      betPick: betPick || "Home",
      market: market || "1X2",
      currencyType: currencyType || "GHS",
      status: "Pending",
    });

    await bet.save();

    return {
      status: 201,
      json: {
        success: true,
        data: bet,
        message: "Virtual game bet saved successfully",
      },
    };
  } catch (error) {
    console.error("Error saving virtual game bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to save bet",
        message: error.message,
      },
    };
  }
}

async function listBetsByUser(userId, query) {
  try {
    const access = await checkPremiumPlusAccess(userId);
    if (access.error) return access.error;

    const { status } = query;

    let filterQuery = { userId };
    if (status && status !== "All") {
      filterQuery.status = status;
    }

    const bets = await VirtualGameBet.find(filterQuery)
      .sort({ createdAt: -1 })
      .exec();

    return {
      status: 200,
      json: {
        success: true,
        data: bets,
        count: bets.length,
      },
    };
  } catch (error) {
    console.error("Error fetching virtual game bets:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch bets",
        message: error.message,
      },
    };
  }
}

async function getBetByTicketId(ticketId) {
  try {
    const bet = await VirtualGameBet.findOne({ ticketId });

    if (!bet) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Bet not found",
        },
      };
    }

    const access = await checkPremiumPlusAccess(bet.userId);
    if (access.error) return access.error;

    return {
      status: 200,
      json: {
        success: true,
        data: bet,
      },
    };
  } catch (error) {
    console.error("Error fetching virtual game bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch bet",
        message: error.message,
      },
    };
  }
}

async function updateBet(ticketIdParam, body) {
  try {
    const trimmed = String(ticketIdParam || "").trim();
    const {
      scoreA,
      scoreB,
      halfTimeScoreA,
      halfTimeScoreB,
      totalReturn,
      status,
      matchHome,
      matchAway,
      market,
      outcome,
      matches,
    } = body;

    let bet = null;
    if (trimmed) {
      bet = await VirtualGameBet.findOne({ ticketId: trimmed });
    }
    if (!bet && body.bookingCode) {
      bet = await VirtualGameBet.findOne({
        bookingCode: String(body.bookingCode).trim(),
      });
    }
    if (!bet && (body._id || body.betId)) {
      const id = body._id || body.betId;
      try {
        bet = await VirtualGameBet.findById(id);
      } catch (e) {
        // invalid ObjectId
      }
    }

    if (!bet) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Bet not found",
        },
      };
    }

    const access = await checkPremiumPlusAccess(bet.userId);
    if (access.error) return access.error;

    if (scoreA !== undefined) bet.scoreA = scoreA;
    if (scoreB !== undefined) bet.scoreB = scoreB;
    if (halfTimeScoreA !== undefined) bet.halfTimeScoreA = halfTimeScoreA;
    if (halfTimeScoreB !== undefined) bet.halfTimeScoreB = halfTimeScoreB;
    if (totalReturn !== undefined) bet.totalReturn = parseFloat(totalReturn);
    if (status) bet.status = status;
    if (matchHome !== undefined) bet.matchHome = matchHome;
    if (matchAway !== undefined) bet.matchAway = matchAway;
    if (market) bet.market = market;
    if (outcome !== undefined) {
      const v = String(outcome || "").trim();
      if (v.toLowerCase() !== "lost") bet.outcome = v;
    }

    if (Array.isArray(matches) && matches.length > 0) {
      bet.matches = matches.map((m, i) => {
        const existing = bet.matches[i] || {};
        return {
          home: m.home !== undefined ? m.home : existing.home,
          away: m.away !== undefined ? m.away : existing.away,
          team: m.team !== undefined ? m.team : existing.team,
          pick: m.pick !== undefined ? m.pick : existing.pick,
          market: m.market !== undefined ? m.market : existing.market,
          odd: m.odd !== undefined ? m.odd : existing.odd,
          matchId: m.matchId !== undefined ? m.matchId : existing.matchId,
          won: m.won !== undefined ? m.won : existing.won,
          status: m.status !== undefined ? m.status : existing.status,
          outcome: (() => {
            const v = m.outcome !== undefined ? m.outcome : existing.outcome;
            const safe = (x) =>
              x && String(x).toLowerCase() !== "lost" ? String(x) : "";
            return safe(v) || safe(existing.outcome) || existing.pick || "";
          })(),
        };
      });
    }

    bet.updatedAt = Date.now();
    await bet.save();

    if (status === "Won" && bet.totalReturn > 0) {
      try {
        const deposit = await Deposit.findOne({ userId: bet.userId });
        if (deposit) {
          deposit.amount += bet.totalReturn;
          await deposit.save();
        }
      } catch (balanceError) {
        console.error("Error updating user balance:", balanceError);
      }
    }

    return {
      status: 200,
      json: {
        success: true,
        data: bet,
        message: "Bet updated successfully",
      },
    };
  } catch (error) {
    console.error("Error updating virtual game bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to update bet",
        message: error.message,
      },
    };
  }
}

async function deleteBet(ticketId) {
  try {
    const existing = await VirtualGameBet.findOne({ ticketId });
    if (!existing) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Bet not found",
        },
      };
    }

    const access = await checkPremiumPlusAccess(existing.userId);
    if (access.error) return access.error;

    const bet = await VirtualGameBet.findOneAndDelete({ ticketId });

    if (!bet) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Bet not found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Bet deleted successfully",
      },
    };
  } catch (error) {
    console.error("Error deleting virtual game bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to delete bet",
        message: error.message,
      },
    };
  }
}

async function listBetsByUserAndStatus(userId, status) {
  try {
    const access = await checkPremiumPlusAccess(userId);
    if (access.error) return access.error;

    const bets = await VirtualGameBet.find({ userId, status })
      .sort({ createdAt: -1 })
      .exec();

    return {
      status: 200,
      json: {
        success: true,
        data: bets,
        count: bets.length,
      },
    };
  } catch (error) {
    console.error("Error fetching bets by status:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch bets",
        message: error.message,
      },
    };
  }
}

module.exports = {
  placeBet,
  listBetsByUser,
  getBetByTicketId,
  updateBet,
  deleteBet,
  listBetsByUserAndStatus,
};
