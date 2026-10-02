const AviatorRound = require("../../models/AviatorRound");
const AviatorBet = require("../../models/AviatorBet");
const User = require("../../models/user");
const { GAME_IDS } = require("../constants/subscriptionTiers");
const { assertGameAccess } = require("./auth/subscription.helper");

// --- Shared round clock --------------------------------------------------------
// Every phone flies the same round at the same moment: rounds run back to
// back on one server-side schedule, and the app follows it (GET
// /aviator/state). These timings must match SportyBet_App's
// AviatorGameScreen (WAITING_MS, POST_CRASH_MS) and AviatorStage
// (GROWTH_RATE: multiplier = e^(0.0832 * seconds)).
const WAITING_MS = 7500;
const POST_CRASH_MS = 5400;
const GROWTH_RATE = 0.0832;
// If nobody asked for a while, a fresh schedule starts "now" instead of
// back-filling every round that would have been played meanwhile.
const CHAIN_GRACE_MS = WAITING_MS;
// Rounds are kept a while after they end so late bet/crash calls still find them.
const KEEP_AFTER_END_MS = 10 * 60 * 1000;

/**
 * @returns {{ user: object } | { error: { status, json } }}
 */
async function checkAviatorAccess(userId) {
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
  const access = assertGameAccess(user, GAME_IDS.AVIATOR);
  if (!access.ok) {
    return { error: { status: access.status, json: access.json } };
  }
  return { user };
}

function generateRoundId() {
  return `AVI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Same long-tail distribution as the client's local fallback, so a round
 * generated here "feels" like the rest of the Aviator round history. */
function generateCrashPoint(minPoint = 1) {
  const instantCrashChance = 0.03;
  const houseEdge = 0.03;
  for (let i = 0; i < 50; i++) {
    const r = Math.random();
    let point;
    if (r < instantCrashChance) point = 1.0;
    else {
      const raw = (1 - houseEdge) / (1 - r);
      point = Math.round(Math.min(Math.max(raw, 1.01), 1000) * 100) / 100;
    }
    if (point >= minPoint) return point;
  }
  return Math.max(minPoint, 2);
}

/** How long the plane flies before reaching `crashPoint`. */
function flightMs(crashPoint) {
  if (!(crashPoint > 1)) return 0;
  return Math.ceil((Math.log(crashPoint) / GROWTH_RATE) * 1000);
}

/** Round number `seq` starting its betting window at `waitStartMs` — read if
 * it's already planned, created otherwise. Two requests racing to create the
 * same `seq` hit the unique index; the loser reads the winner's round, so
 * everyone (every phone, every website user) sees one schedule. */
async function createScheduledRound(seq, waitStartMs) {
  const existing = await AviatorRound.findOne({ seq });
  if (existing) return existing;

  const crashPoint = generateCrashPoint();
  const takeoffMs = waitStartMs + WAITING_MS;
  const crashMs = takeoffMs + flightMs(crashPoint);
  const endMs = crashMs + POST_CRASH_MS;
  try {
    await AviatorRound.create({
      seq,
      roundId: generateRoundId(),
      crashPoint,
      waitStartAt: new Date(waitStartMs),
      takeoffAt: new Date(takeoffMs),
      crashAt: new Date(crashMs),
      endAt: new Date(endMs),
      expiresAt: new Date(endMs + KEEP_AFTER_END_MS),
      isUsed: false,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  return AviatorRound.findOne({ seq });
}

/** The round right after `round` on the schedule (back to back). */
function roundAfter(round) {
  return createScheduledRound(round.seq + 1, round.endAt.getTime());
}

/**
 * The live schedule at `now`: `current` is the round whose betting window,
 * flight or "flew away" screen is on now; `next` follows it back to back.
 * Rounds may already be planned further ahead (see findUpcomingInRange).
 */
async function getTimeline(now = Date.now()) {
  let current = await AviatorRound.findOne({
    seq: { $exists: true },
    waitStartAt: { $lte: new Date(now) },
  }).sort({ seq: -1 });

  if (!current || current.endAt.getTime() <= now) {
    // Nothing on now: either no schedule yet, or every planned round is over
    // (planned rounds chain back to back, so a later one would be "on").
    const latest = await AviatorRound.findOne({ seq: { $exists: true } }).sort({ seq: -1 });
    const chain = latest && now - latest.endAt.getTime() < CHAIN_GRACE_MS;
    current = await createScheduledRound(
      (latest?.seq || 0) + 1,
      chain ? latest.endAt.getTime() : now
    );
  }

  // Once the current round has taken off, make sure the next one exists so
  // phones have it by the crash; before that, use it if already planned.
  const next =
    now >= current.takeoffAt.getTime()
      ? await roundAfter(current)
      : await AviatorRound.findOne({ seq: current.seq + 1 });
  return { now, current, next };
}

/** The round the next take-off will use: `current` until it crashes, then `next`. */
async function getUpcomingRound() {
  const { now, current, next } = await getTimeline();
  if (now < current.crashAt.getTime()) return current;
  return next || roundAfter(current);
}

/** The round a bet placed now belongs to: `current` while its betting window
 * is open, otherwise the next one. */
async function getBettingRound() {
  const { now, current, next } = await getTimeline();
  if (now < current.takeoffAt.getTime()) return current;
  return next || roundAfter(current);
}

// How far ahead a range lookup may plan rounds. The 20x–70x range hits
// roughly 1 round in 30, so this almost always finds one (~1 hour ahead).
const MAX_LOOKAHEAD_ROUNDS = 150;
// A round is only offered while its betting window still has this long to
// run, so the player has time to place a bet before take-off.
const MIN_BET_TIME_MS = 2500;

/**
 * The first round on the schedule that hasn't taken off yet (with time left
 * to bet) and whose crash point is within [min, max]. Rounds are planned
 * ahead as needed and stored, so every caller gets the same answer and the
 * phones later fly exactly these rounds.
 */
async function findUpcomingInRange(min, max) {
  const { now, current } = await getTimeline();
  const planned = await AviatorRound.find({ seq: { $gt: current.seq } }).sort({ seq: 1 });

  let round = current;
  for (let ahead = 0; ahead <= MAX_LOOKAHEAD_ROUNDS; ahead++) {
    if (ahead > 0) {
      const nextPlanned = planned[ahead - 1];
      round = nextPlanned && nextPlanned.seq === round.seq + 1 ? nextPlanned : await roundAfter(round);
    }
    const bettable = round.takeoffAt.getTime() - now >= MIN_BET_TIME_MS;
    if (bettable && round.crashPoint >= min && round.crashPoint <= max) {
      return { now, round, roundsAhead: ahead };
    }
  }
  return { now, round: null, roundsAhead: null };
}

/** GET /aviator/upcoming?min=&max= — next round in a multiplier range. */
async function getUpcomingInRange(query = {}) {
  const min = Number(query.min);
  const max = Number(query.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return { status: 400, json: { success: false, error: "min and max are required (min <= max)" } };
  }
  try {
    const { now, round, roundsAhead } = await findUpcomingInRange(min, max);
    return {
      status: 200,
      json: {
        success: true,
        data: {
          serverNow: now,
          found: !!round,
          roundsAhead,
          round: roundSchedule(round),
        },
      },
    };
  } catch (error) {
    console.error("Error finding upcoming aviator round:", error);
    return {
      status: 500,
      json: { success: false, error: "Failed to find upcoming round", message: error.message },
    };
  }
}

function roundSchedule(round) {
  if (!round) return null;
  return {
    roundId: round.roundId,
    crashPoint: round.crashPoint,
    waitStartAt: round.waitStartAt.getTime(),
    takeoffAt: round.takeoffAt.getTime(),
    crashAt: round.crashAt.getTime(),
    endAt: round.endAt.getTime(),
  };
}

/** GET /aviator/state — the shared clock the app follows. `serverNow` lets
 * each phone correct for its own clock being off. */
async function getState() {
  try {
    const { now, current, next } = await getTimeline();
    return {
      status: 200,
      json: {
        success: true,
        data: {
          serverNow: now,
          current: roundSchedule(current),
          next: roundSchedule(next),
          timings: { waitingMs: WAITING_MS, postCrashMs: POST_CRASH_MS, growthRate: GROWTH_RATE },
        },
      },
    };
  } catch (error) {
    console.error("Error fetching aviator state:", error);
    return {
      status: 500,
      json: { success: false, error: "Failed to fetch aviator state", message: error.message },
    };
  }
}

/** GET /aviator/result — the next crash point (what the website shows): the
 * round on now until it crashes, then the one after it. */
async function getCurrentResult() {
  try {
    const round = await getUpcomingRound();

    return {
      status: 200,
      json: {
        success: true,
        data: {
          crashPoint: round.crashPoint,
          roundId: round.roundId,
          // Kept for existing callers: the moment this result stops being "next".
          expiresAt: round.crashAt,
          takeoffAt: round.takeoffAt,
          crashAt: round.crashAt,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching aviator result:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch aviator result",
        message: error.message,
      },
    };
  }
}

async function markUsed(body) {
  try {
    const { roundId } = body;

    if (!roundId) {
      return {
        status: 400,
        json: { success: false, error: "roundId is required" },
      };
    }

    const round = await AviatorRound.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!round) {
      return {
        status: 404,
        json: { success: false, error: "Round not found or already used" },
      };
    }

    return {
      status: 200,
      json: { success: true, message: "Round marked as used" },
    };
  } catch (error) {
    console.error("Error marking aviator round as used:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to mark aviator round as used",
        message: error.message,
      },
    };
  }
}

async function placeBet(body) {
  try {
    const { userId, panelId, stake, currencyType } = body;

    if (!userId || !panelId || stake === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, panelId, stake",
        },
      };
    }

    const access = await checkAviatorAccess(userId);
    if (access.error) return access.error;

    // roundId is optional: the client omits it when its /aviator/result
    // fetch hasn't come back yet, and the bet goes on the upcoming round.
    // The round is returned either way so the client can fly that round.
    let { roundId } = body;
    let round = null;
    if (!roundId) {
      round = await getBettingRound();
      roundId = round.roundId;
    }

    const bet = new AviatorBet({
      userId,
      roundId,
      panelId,
      stake,
      crashPoint: 0,
      status: "active",
      currencyType: currencyType || "GHS",
    });

    await bet.save();

    return {
      status: 201,
      json: {
        success: true,
        data: bet,
        round: round
          ? { roundId: round.roundId, crashPoint: round.crashPoint, expiresAt: round.expiresAt }
          : { roundId },
        message: "Bet saved successfully",
      },
    };
  } catch (error) {
    console.error("Error saving aviator bet:", error);
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

/** Voids a still-active bet (the panel cancelled it before its round took
 * off) — no crash-point equivalent exists for this in HeroCrash, since its
 * client doesn't support a pre-flight cancel. */
async function cancelBet(body) {
  try {
    const { userId, roundId, panelId } = body;

    if (!userId || !roundId || !panelId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, roundId, panelId",
        },
      };
    }

    const bet = await AviatorBet.findOneAndUpdate(
      { userId, roundId, panelId, status: "active" },
      { $set: { status: "cancelled" } },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!bet) {
      return {
        status: 404,
        json: { success: false, error: "Active bet not found" },
      };
    }

    return {
      status: 200,
      json: { success: true, data: bet, message: "Bet cancelled" },
    };
  } catch (error) {
    console.error("Error cancelling aviator bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to cancel bet",
        message: error.message,
      },
    };
  }
}

async function cashout(body) {
  try {
    const { userId, roundId, panelId, cashoutMultiplier } = body;

    if (!userId || !roundId || !panelId || cashoutMultiplier === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error:
            "Missing required fields: userId, roundId, panelId, cashoutMultiplier",
        },
      };
    }

    const access = await checkAviatorAccess(userId);
    if (access.error) return access.error;

    // A crashed bet is accepted too, as long as the cash out came in below
    // the crash point: the client's crash report can reach the server just
    // before a cashout made at nearly the same moment (or one an auto cash
    // out made for a round that ended while the app was in the background).
    const bet = await AviatorBet.findOne({
      userId,
      roundId,
      panelId,
      status: { $in: ["active", "crashed"] },
    }).sort({ createdAt: -1 });

    if (!bet || (bet.status === "crashed" && !(cashoutMultiplier < bet.crashPoint))) {
      return {
        status: 404,
        json: { success: false, error: "Active bet not found" },
      };
    }

    const winAmount = bet.stake * cashoutMultiplier;

    bet.cashoutMultiplier = cashoutMultiplier;
    bet.winAmount = winAmount;
    bet.status = "cashed_out";

    await bet.save();

    return {
      status: 200,
      json: { success: true, data: bet, message: "Cashout recorded successfully" },
    };
  } catch (error) {
    console.error("Error recording aviator cashout:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to record cashout",
        message: error.message,
      },
    };
  }
}

async function applyCrash(body) {
  try {
    const { roundId, crashPoint } = body;

    if (!roundId || crashPoint === undefined) {
      return {
        status: 400,
        json: { success: false, error: "Missing required fields: roundId, crashPoint" },
      };
    }

    const result = await AviatorBet.updateMany(
      { roundId, status: "active" },
      { $set: { crashPoint, status: "crashed", winAmount: 0 } }
    );

    return {
      status: 200,
      json: {
        success: true,
        message: "Bets updated after crash",
        updatedCount: result.modifiedCount,
      },
    };
  } catch (error) {
    console.error("Error updating aviator bets after crash:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to update bets after crash",
        message: error.message,
      },
    };
  }
}

async function betHistory(query) {
  try {
    const { userId, filter = "all", limit = 100 } = query;

    let filterQuery = {};

    if (userId) {
      const access = await checkAviatorAccess(userId);
      if (access.error) return access.error;

      filterQuery.userId = userId;
    }

    if (filter === "top-wins") {
      filterQuery.status = "cashed_out";
      filterQuery.winAmount = { $gt: 0 };
    }

    let bets = await AviatorBet.find(filterQuery)
      .populate("userId", "name phoneNumber")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    if (filter === "top-wins") {
      bets = [...bets].sort((a, b) => b.winAmount - a.winAmount);
    }

    return {
      status: 200,
      json: { success: true, data: bets, count: bets.length },
    };
  } catch (error) {
    console.error("Error fetching aviator bet history:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch bet history",
        message: error.message,
      },
    };
  }
}

module.exports = {
  getCurrentResult,
  getState,
  getUpcomingInRange,
  markUsed,
  placeBet,
  cancelBet,
  cashout,
  applyCrash,
  betHistory,
};
