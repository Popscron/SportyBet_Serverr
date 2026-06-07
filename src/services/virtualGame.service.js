const VirtualGameBet = require("../../models/VirtualGameBet");
const Deposit = require("../../models/Deposit");
const User = require("../../models/user");
const { GAME_IDS } = require("../constants/subscriptionTiers");
const { assertGameAccess } = require("./auth/subscription.helper");

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

function formatFt(scoreA, scoreB) {
  if (scoreA == null || scoreB == null) return "";
  return `${scoreA} - ${scoreB}`;
}

function formatHt(halfTimeScoreA, halfTimeScoreB) {
  if (halfTimeScoreA == null || halfTimeScoreB == null) return "";
  return `${halfTimeScoreA}-${halfTimeScoreB}`;
}

function normalizeMatchLeg(m, rootFallback) {
  const ftPair = parseScorePair(m?.ft);
  const htPair = parseScorePair(m?.ht);
  const scoreA =
    toScoreNum(m?.scoreA) ??
    ftPair?.a ??
    (rootFallback ? toScoreNum(rootFallback.scoreA) : null);
  const scoreB =
    toScoreNum(m?.scoreB) ??
    ftPair?.b ??
    (rootFallback ? toScoreNum(rootFallback.scoreB) : null);
  const halfTimeScoreA =
    toScoreNum(m?.halfTimeScoreA) ??
    htPair?.a ??
    (rootFallback ? toScoreNum(rootFallback.halfTimeScoreA) : null);
  const halfTimeScoreB =
    toScoreNum(m?.halfTimeScoreB) ??
    htPair?.b ??
    (rootFallback ? toScoreNum(rootFallback.halfTimeScoreB) : null);

  return {
    home: m?.home ?? "",
    away: m?.away ?? "",
    team: m?.team ?? "",
    pick: m?.pick ?? "",
    market: m?.market ?? "",
    odd: m?.odd ?? "",
    matchId: m?.matchId ?? "",
    won: m?.won !== undefined ? m.won : null,
    status: m?.status ?? "",
    outcome: m?.outcome ?? "",
    scoreA,
    scoreB,
    halfTimeScoreA,
    halfTimeScoreB,
    ft:
      m?.ft != null && String(m.ft).trim() !== ""
        ? String(m.ft).trim()
        : formatFt(scoreA, scoreB),
    ht:
      m?.ht != null && String(m.ht).trim() !== ""
        ? String(m.ht).trim()
        : formatHt(halfTimeScoreA, halfTimeScoreB),
    htSeq: m?.htSeq ?? m?.htSequence ?? "",
    ftSeq: m?.ftSeq ?? m?.ftSequence ?? "",
  };
}

function normalizeVirtualBetDoc(bet) {
  const obj = bet?.toObject ? bet.toObject() : { ...(bet || {}) };
  const rootFallback = {
    scoreA: obj.scoreA,
    scoreB: obj.scoreB,
    halfTimeScoreA: obj.halfTimeScoreA,
    halfTimeScoreB: obj.halfTimeScoreB,
    ft: obj.ft,
    ht: obj.ht,
  };
  const matches = Array.isArray(obj.matches) ? obj.matches : [];
  obj.matches = matches.map((m, i) =>
    normalizeMatchLeg(m, i === 0 ? rootFallback : null)
  );

  const m0 = obj.matches[0];
  if (m0) {
    if (obj.scoreA == null && m0.scoreA != null) obj.scoreA = m0.scoreA;
    if (obj.scoreB == null && m0.scoreB != null) obj.scoreB = m0.scoreB;
    if (obj.halfTimeScoreA == null && m0.halfTimeScoreA != null) {
      obj.halfTimeScoreA = m0.halfTimeScoreA;
    }
    if (obj.halfTimeScoreB == null && m0.halfTimeScoreB != null) {
      obj.halfTimeScoreB = m0.halfTimeScoreB;
    }
    if (!obj.ft && m0.ft) obj.ft = m0.ft;
    if (!obj.ht && m0.ht) obj.ht = m0.ht;
  }

  if (!obj.ft && obj.scoreA != null && obj.scoreB != null) {
    obj.ft = formatFt(obj.scoreA, obj.scoreB);
  }
  if (!obj.ht && obj.halfTimeScoreA != null && obj.halfTimeScoreB != null) {
    obj.ht = formatHt(obj.halfTimeScoreA, obj.halfTimeScoreB);
  }

  return obj;
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
  const user = await User.findById(userId).select(
    "subscription expiry role allowedGames smsPoints"
  );
  if (!user) {
    return {
      error: {
        status: 404,
        json: { success: false, error: "User not found" },
      },
    };
  }
  const access = assertGameAccess(user, GAME_IDS.INSTANT_FOOTBALL);
  if (!access.ok) {
    return { error: { status: access.status, json: access.json } };
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
        data: normalizeVirtualBetDoc(bet),
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
      ht,
      ft,
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

    if (scoreA !== undefined) bet.scoreA = toScoreNum(scoreA);
    if (scoreB !== undefined) bet.scoreB = toScoreNum(scoreB);
    if (halfTimeScoreA !== undefined) {
      bet.halfTimeScoreA = toScoreNum(halfTimeScoreA);
    }
    if (halfTimeScoreB !== undefined) {
      bet.halfTimeScoreB = toScoreNum(halfTimeScoreB);
    }
    if (ft !== undefined) bet.ft = String(ft || "").trim();
    if (ht !== undefined) bet.ht = String(ht || "").trim();
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
      const existingMatches = Array.isArray(bet.matches) ? bet.matches : [];
      bet.matches = matches.map((m, i) => {
        const existing = existingMatches[i] || {};
        const legScoreA =
          m.scoreA !== undefined ? toScoreNum(m.scoreA) : toScoreNum(existing.scoreA);
        const legScoreB =
          m.scoreB !== undefined ? toScoreNum(m.scoreB) : toScoreNum(existing.scoreB);
        const legHalfTimeScoreA =
          m.halfTimeScoreA !== undefined
            ? toScoreNum(m.halfTimeScoreA)
            : toScoreNum(existing.halfTimeScoreA);
        const legHalfTimeScoreB =
          m.halfTimeScoreB !== undefined
            ? toScoreNum(m.halfTimeScoreB)
            : toScoreNum(existing.halfTimeScoreB);
        const legFt =
          m.ft !== undefined
            ? String(m.ft || "").trim()
            : existing.ft || formatFt(legScoreA, legScoreB);
        const legHt =
          m.ht !== undefined
            ? String(m.ht || "").trim()
            : existing.ht || formatHt(legHalfTimeScoreA, legHalfTimeScoreB);
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
          scoreA: legScoreA,
          scoreB: legScoreB,
          halfTimeScoreA: legHalfTimeScoreA,
          halfTimeScoreB: legHalfTimeScoreB,
          ft: legFt,
          ht: legHt,
          htSeq:
            m.htSeq !== undefined
              ? String(m.htSeq || "")
              : m.htSequence !== undefined
                ? String(m.htSequence || "")
                : existing.htSeq || existing.htSequence || "",
          ftSeq:
            m.ftSeq !== undefined
              ? String(m.ftSeq || "")
              : m.ftSequence !== undefined
                ? String(m.ftSequence || "")
                : existing.ftSeq || existing.ftSequence || "",
        };
      });
      bet.markModified("matches");

      const m0 = bet.matches[0];
      if (m0) {
        if (scoreA === undefined && m0.scoreA != null) bet.scoreA = m0.scoreA;
        if (scoreB === undefined && m0.scoreB != null) bet.scoreB = m0.scoreB;
        if (halfTimeScoreA === undefined && m0.halfTimeScoreA != null) {
          bet.halfTimeScoreA = m0.halfTimeScoreA;
        }
        if (halfTimeScoreB === undefined && m0.halfTimeScoreB != null) {
          bet.halfTimeScoreB = m0.halfTimeScoreB;
        }
        if (ft === undefined && m0.ft) bet.ft = m0.ft;
        if (ht === undefined && m0.ht) bet.ht = m0.ht;
      }
    }

    if (!bet.ft && bet.scoreA != null && bet.scoreB != null) {
      bet.ft = formatFt(bet.scoreA, bet.scoreB);
    }
    if (!bet.ht && bet.halfTimeScoreA != null && bet.halfTimeScoreB != null) {
      bet.ht = formatHt(bet.halfTimeScoreA, bet.halfTimeScoreB);
    }

    bet.updatedAt = Date.now();
    await bet.save();

    if (status === "Won" && bet.totalReturn > 0) {
      try {
        const deposit = await Deposit.findOne({ userId: bet.userId });
        if (deposit) {
          deposit.amount = Number(deposit.amount || 0) + Number(bet.totalReturn || 0);
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
        data: normalizeVirtualBetDoc(bet),
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

    const statusKey = String(status || "").trim();
    let statusFilter = statusKey;
    if (statusKey === "Settled") {
      statusFilter = { $in: ["Won", "Lost"] };
    } else if (statusKey === "Unsettled") {
      statusFilter = "Pending";
    }

    const bets = await VirtualGameBet.find({ userId, status: statusFilter })
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
