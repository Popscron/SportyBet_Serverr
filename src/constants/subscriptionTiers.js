/**
 * SportyBet subscription tiers and feature entitlements.
 * Assign tiers from SportyBet_Website admin; app + APIs read via subscription.helper.js
 */

const GAME_IDS = {
  SPIN_BOTTLE: "spinBottle",
  INSTANT_FOOTBALL: "instantFootball",
  HERO_CRASH: "heroCrash",
};

const ALL_GAMES = [
  GAME_IDS.SPIN_BOTTLE,
  GAME_IDS.INSTANT_FOOTBALL,
  GAME_IDS.HERO_CRASH,
];

/** Canonical tier names (use these in admin UI). */
const SUBSCRIPTION_TIERS = [
  "Games Bottle Flip",
  "Games Instant Virtuals",
  "Games Sporty Hero",
  "Premium",
  "Premium Pro",
  "Premium Plus",
  "Optimum",
];

const TIER_DEFINITIONS = {
  "Games Bottle Flip": {
    label: "Games — Bottle flip only",
    games: [GAME_IDS.SPIN_BOTTLE],
    openBets: false,
    matchDetails: false,
    maxDevices: 1,
    isPremium: false,
    gamesTab: true,
  },
  "Games Instant Virtuals": {
    label: "Games — Instant virtuals only",
    games: [GAME_IDS.INSTANT_FOOTBALL],
    openBets: false,
    matchDetails: false,
    maxDevices: 1,
    isPremium: false,
    gamesTab: true,
  },
  "Games Sporty Hero": {
    label: "Games — Sporty Hero only",
    games: [GAME_IDS.HERO_CRASH],
    openBets: false,
    matchDetails: false,
    maxDevices: 1,
    isPremium: false,
    gamesTab: true,
  },
  Premium: {
    label: "Premium — betting only (no games, no match details)",
    games: [],
    openBets: true,
    matchDetails: false,
    maxDevices: 999,
    isPremium: true,
    gamesTab: false,
  },
  "Premium Pro": {
    label: "Premium Pro — match details + 30 SMS points",
    games: [],
    openBets: true,
    matchDetails: true,
    maxDevices: 999,
    isPremium: true,
    gamesTab: false,
    smsPointsOnAssign: 30,
  },
  "Premium Plus": {
    label: "Premium Plus — 2 games (no open bets, no match details)",
    games: [GAME_IDS.SPIN_BOTTLE, GAME_IDS.HERO_CRASH],
    openBets: false,
    matchDetails: false,
    maxDevices: 2,
    isPremium: true,
    gamesTab: true,
    allowCustomGames: true,
  },
  Optimum: {
    label: "Optimum — full access",
    games: [...ALL_GAMES],
    openBets: true,
    matchDetails: true,
    maxDevices: 999,
    isPremium: true,
    gamesTab: true,
  },
};


const LEGACY_TIER_ALIASES = {
  Basic: "Premium",
  Games: "Premium",
  "Premium Plus (legacy)": "Optimum",
};

function normalizeSubscriptionTier(raw) {
  const key = String(raw || "Premium").trim();
  if (TIER_DEFINITIONS[key]) return key;
  if (key === "Premium Plus") {
    return "Premium Plus";
  }
  if (LEGACY_TIER_ALIASES[key]) return LEGACY_TIER_ALIASES[key];
  return "Premium";
}

module.exports = {
  GAME_IDS,
  ALL_GAMES,
  SUBSCRIPTION_TIERS,
  TIER_DEFINITIONS,
  LEGACY_TIER_ALIASES,
  normalizeSubscriptionTier,
};
