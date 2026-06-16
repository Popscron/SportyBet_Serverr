const RedBlackBet = require("../../models/RedBlackBet");
const RedBlackRound = require("../../models/RedBlackRound");
const User = require("../../models/user");
const { GAME_IDS } = require("../constants/subscriptionTiers");
const { assertGameAccess } = require("./auth/subscription.helper");

const MIN_BET = 10;
const MAX_BET = 2500000;
const TURN_LIMIT = 5;
const ROUND_TTL_MS = 30 * 60 * 1000;

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
    const { userId, roundId, pick: rawPick, stake, currencyType } = body;
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

    const round = await RedBlackRound.findOne({
      userId,
      roundId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

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

    const card = round.deck.shift();
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
  MIN_BET,
  MAX_BET,
  TURN_LIMIT,
};
