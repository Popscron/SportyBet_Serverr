const RedBlackBet = require("../../models/RedBlackBet");
const RedBlackRound = require("../../models/RedBlackRound");
const RedBlackResult = require("../../models/RedBlackResult");
const User = require("../../models/user");
const { GAME_IDS } = require("../constants/subscriptionTiers");
const { assertGameAccess } = require("./auth/subscription.helper");

const MIN_BET = 10;
const MAX_BET = 2500000;
const TURN_LIMIT = 5;
const ROUND_TTL_MS = 30 * 60 * 1000;
/**
 * Reddict website + app shared signal TTL. Must stay identical to
 * flowdict_server/routes/redBlackRoute.js's copy of this constant (both read
 * the same RedBlackResult collection). Kept long enough that a normal
 * confirm-bet flow in the app finishes before the signal rotates — too short
 * and the site can show a color that has already expired by the time the
 * player places the matching bet.
 */
const DICT_RESULT_TTL_MS = 60 * 1000;

const SUITS = ["♥", "♦", "♣", "♠"];
const RED_SUITS = ["♥", "♦"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function generateRoundId() {
  return `RB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateBetCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        rank,
        suit,
        color: RED_SUITS.includes(suit) ? "RED" : "BLACK",
      });
    }
  }
  deck.push({ rank: null, suit: "🃏", color: "GREEN" });
  deck.push({ rank: null, suit: "🃏", color: "GREEN" });
  return shuffle(deck);
}

function normalizePick(pick) {
  const value = String(pick || "").trim().toUpperCase();
  if (value === "RED" || value === "R") return "RED";
  if (value === "BLACK" || value === "B") return "BLACK";
  return null;
}

function didPickWin(pick, card) {
  if (!pick || !card) return false;
  if (card.color === "GREEN") return false;
  return card.color === pick;
}

async function checkUserAccess(userId) {
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

  const access = assertGameAccess(user, GAME_IDS.RED_BLACK);
  if (!access.ok) {
    return { error: { status: access.status, json: access.json } };
  }

  return { user };
}

async function getActiveRound(userId) {
  const now = new Date();
  return RedBlackRound.findOne({
    userId,
    status: "active",
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });
}

function serializeRound(round) {
  return {
    roundId: round.roundId,
    turnNumber: round.turnNumber,
    minBet: round.minBet,
    status: round.status,
    drawnCards: round.drawnCards || [],
    currencyType: round.currencyType || "NGN",
    expiresAt: round.expiresAt,
  };
}

async function startRound(body) {
  try {
    const { userId, currencyType } = body;
    const access = await checkUserAccess(userId);
    if (access.error) return access.error;

    const now = new Date();
    await RedBlackRound.updateMany(
      { userId, status: "active" },
      { $set: { status: "ended", updatedAt: now } }
    );

    const round = new RedBlackRound({
      userId,
      roundId: generateRoundId(),
      deck: buildShuffledDeck(),
      drawnCards: [],
      turnNumber: 1,
      minBet: MIN_BET,
      status: "active",
      currencyType: currencyType || "NGN",
      expiresAt: new Date(now.getTime() + ROUND_TTL_MS),
    });

    await round.save();

    return {
      status: 201,
      json: {
        success: true,
        data: serializeRound(round),
        message: "Round started",
      },
    };
  } catch (error) {
    console.error("Error starting red-black round:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to start round",
        message: error.message,
      },
    };
  }
}

async function getRound(query) {
  try {
    const { userId } = query;
    const access = await checkUserAccess(userId);
    if (access.error) return access.error;

    const round = await getActiveRound(userId);
    if (!round) {
      return {
        status: 404,
        json: {
          success: false,
          error: "No active round found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: serializeRound(round),
      },
    };
  } catch (error) {
    console.error("Error fetching red-black round:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch round",
        message: error.message,
      },
    };
  }
}

async function playHand(body) {
  try {
    const { userId, roundId, pick: rawPick, stake, currencyType, dictRoundId } = body;
    const pick = normalizePick(rawPick);
    const stakeNum = Number(stake);

    if (!userId || !roundId || !pick || !Number.isFinite(stakeNum)) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, roundId, pick (RED|BLACK), stake",
        },
      };
    }

    const access = await checkUserAccess(userId);
    if (access.error) return access.error;

    let round = await RedBlackRound.findOne({
      userId,
      roundId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    if (!round) {
      round = await getActiveRound(userId);
    }

    if (!round) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Active round not found",
        },
      };
    }

    if (round.turnNumber > TURN_LIMIT) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Turn limit reached for this round",
        },
      };
    }

    const minBet = Number(round.minBet || MIN_BET);
    const finalStake = Math.max(minBet, Math.min(stakeNum, MAX_BET));

    if (finalStake < minBet) {
      return {
        status: 400,
        json: {
          success: false,
          error: `Minimum stake for this hand is ${minBet}`,
        },
      };
    }

    if (!round.deck || round.deck.length === 0) {
      round.deck = buildShuffledDeck();
    }

    // If the roundId the client captured earlier has since expired/rotated,
    // fall back to whatever dict result is live *right now* instead of an
    // unrelated random card — that keeps the played card tied to a real
    // published signal (matching the website) rather than pure chance.
    let dictRow = await loadActiveDictResult(dictRoundId);
    if (!dictRow) {
      dictRow = await loadOrCreateCurrentDictResult();
    }
    const card = resolveDictPlayCard(round.deck, dictRow);
    const won = didPickWin(pick, card);
    const winAmount = won ? finalStake * 2 : 0;
    const status = won ? "won" : "lost";

    let betCode;
    let isUnique = false;
    while (!isUnique) {
      betCode = generateBetCode();
      const existingBet = await RedBlackBet.findOne({ betCode });
      if (!existingBet) isUnique = true;
    }

    const bet = new RedBlackBet({
      userId,
      roundId,
      turnNumber: round.turnNumber,
      pick,
      stake: finalStake,
      card,
      status,
      winAmount,
      currencyType: currencyType || round.currencyType || "NGN",
      betCode,
    });

    await bet.save();

    round.drawnCards = [...(round.drawnCards || []), card];
    round.minBet = won ? Math.min(winAmount, MAX_BET) : MIN_BET;
    round.turnNumber = round.turnNumber + 1;
    round.updatedAt = new Date();

    const roundEnded = !won || round.turnNumber > TURN_LIMIT;
    if (roundEnded) {
      round.status = "ended";
    }

    await round.save();

    if (dictRow?.roundId) {
      await RedBlackResult.findOneAndUpdate(
        { roundId: dictRow.roundId, isUsed: false },
        { isUsed: true }
      );
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          bet,
          card,
          pick,
          stake: finalStake,
          won,
          status,
          winAmount,
          payout: winAmount,
          turnNumber: bet.turnNumber,
          nextMinBet: round.minBet,
          roundEnded,
          round: serializeRound(round),
        },
        message: won ? "Hand won" : "Hand lost",
      },
    };
  } catch (error) {
    console.error("Error playing red-black hand:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to play hand",
        message: error.message,
      },
    };
  }
}

async function endRound(body) {
  try {
    const { userId, roundId } = body;
    if (!userId || !roundId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId and roundId are required",
        },
      };
    }

    const access = await checkUserAccess(userId);
    if (access.error) return access.error;

    const round = await RedBlackRound.findOneAndUpdate(
      { userId, roundId, status: "active" },
      { $set: { status: "ended", updatedAt: new Date() } },
      { new: true }
    );

    if (!round) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Active round not found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: serializeRound(round),
        message: "Round ended",
      },
    };
  } catch (error) {
    console.error("Error ending red-black round:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to end round",
        message: error.message,
      },
    };
  }
}

function generateDictRoundId() {
  return `RBD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateDictCardColor() {
  return Math.random() < 0.5 ? "RED" : "BLACK";
}

function buildSampleCard(color) {
  if (color === "RED") {
    return { rank: "A", suit: "♥", color: "RED" };
  }
  return { rank: "K", suit: "♠", color: "BLACK" };
}

/** Pick a concrete rank/suit for dict + app sync (same card on website and in-game). */
function pickRandomCardForColor(color) {
  const deck = buildShuffledDeck();
  return pickCardForDictColor(deck, color);
}

function resolveDictPlayCard(deck, dictRow) {
  if (!dictRow) {
    return deck.shift();
  }

  const stored = dictRow.card;
  if (stored?.color && (stored.rank || stored.suit)) {
    const card = {
      rank: stored.rank ?? null,
      suit: stored.suit || "♥",
      color: stored.color,
    };
    const idx = deck.findIndex(
      (c) =>
        c?.suit === card.suit &&
        String(c?.rank ?? "") === String(card.rank ?? "") &&
        c?.color === card.color
    );
    if (idx >= 0) {
      deck.splice(idx, 1);
      return card;
    }
    return card;
  }

  if (dictRow.color) {
    return pickCardForDictColor(deck, dictRow.color);
  }

  return deck.shift();
}

function pickCardForDictColor(deck, forcedColor) {
  if (!Array.isArray(deck) || deck.length === 0) {
    return buildSampleCard(forcedColor);
  }

  if (!forcedColor || forcedColor === "GREEN") {
    return deck.shift();
  }

  const matchIdx = deck.findIndex((c) => c?.color === forcedColor);
  if (matchIdx >= 0) {
    return deck.splice(matchIdx, 1)[0];
  }

  const fallback = deck.shift();
  return {
    ...buildSampleCard(forcedColor),
    rank: fallback?.rank || buildSampleCard(forcedColor).rank,
  };
}

async function loadActiveDictResult(dictRoundId) {
  if (!dictRoundId) return null;
  const now = new Date();
  return RedBlackResult.findOne({
    roundId: dictRoundId,
    isUsed: false,
    expiresAt: { $gt: now },
  });
}

/** Get the currently published dict result, minting a new one if the previous one expired. */
async function loadOrCreateCurrentDictResult() {
  const now = new Date();
  let currentResult = await RedBlackResult.findOne({
    expiresAt: { $gt: now },
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!currentResult) {
    let color = generateDictCardColor();

    try {
      const lastTwo = await RedBlackResult.find({})
        .sort({ createdAt: -1 })
        .limit(2)
        .lean();

      if (
        Array.isArray(lastTwo) &&
        lastTwo.length === 2 &&
        lastTwo[0]?.color &&
        lastTwo[0].color === lastTwo[1]?.color &&
        lastTwo[0].color === color
      ) {
        color = color === "RED" ? "BLACK" : "RED";
      }
    } catch (e) {
      console.warn("RedBlackResult streak cap failed:", e?.message || e);
    }

    const roundId = generateDictRoundId();
    const expiresAt = new Date(now.getTime() + DICT_RESULT_TTL_MS);

    currentResult = await RedBlackResult.create({
      color,
      card: pickRandomCardForColor(color),
      roundId,
      expiresAt,
      isUsed: false,
    });
  }

  return currentResult;
}

async function getCurrentResult() {
  try {
    const currentResult = await loadOrCreateCurrentDictResult();

    return {
      status: 200,
      json: {
        success: true,
        data: {
          color: currentResult.color,
          card: currentResult.card,
          roundId: currentResult.roundId,
          expiresAt: currentResult.expiresAt,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching red-black result:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch red-black result",
        message: error.message,
      },
    };
  }
}

async function markResultUsed(body) {
  try {
    const { roundId } = body;

    if (!roundId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "roundId is required",
        },
      };
    }

    const result = await RedBlackResult.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!result) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Result not found or already used",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Result marked as used",
      },
    };
  } catch (error) {
    console.error("Error marking red-black result used:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to mark result as used",
        message: error.message,
      },
    };
  }
}

async function betHistory(query) {
  try {
    const { userId, limit = 100 } = query;
    if (!userId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId is required",
        },
      };
    }

    const access = await checkUserAccess(userId);
    if (access.error) return access.error;

    const bets = await RedBlackBet.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 100, 200));

    return {
      status: 200,
      json: {
        success: true,
        data: bets,
        count: bets.length,
      },
    };
  } catch (error) {
    console.error("Error fetching red-black bet history:", error);
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
  startRound,
  getRound,
  playHand,
  endRound,
  betHistory,
  getCurrentResult,
  markResultUsed,
  MIN_BET,
  MAX_BET,
  TURN_LIMIT,
};
