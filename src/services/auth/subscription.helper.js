/**
 * Subscription / device-limit / feature entitlements (shared by login, profile, game APIs).
 */
const {
  TIER_DEFINITIONS,
  SUBSCRIPTION_TIERS,
  normalizeSubscriptionTier,
} = require("../../constants/subscriptionTiers");

function isSubscriptionActive(user) {
  if (!user) return false;
  return !user.expiry || new Date(user.expiry) > new Date();
}

function getEntitlements(user) {
  if (!user) {
    return {
      tier: "Premium",
      isActive: false,
      isAdmin: false,
      games: [],
      openBets: false,
      matchDetails: false,
      gamesTab: false,
      maxDevices: 1,
      isPremium: false,
      smsPoints: 0,
    };
  }

  if (user.role === "admin") {
    return {
      tier: "admin",
      isActive: true,
      isAdmin: true,
      games: ["spinBottle", "instantFootball", "heroCrash"],
      openBets: true,
      matchDetails: true,
      gamesTab: true,
      maxDevices: 999,
      isPremium: true,
      smsPoints: user.smsPoints ?? 0,
    };
  }

  const tier = normalizeSubscriptionTier(user.subscription);
  const def = TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.Premium;
  const isActive = isSubscriptionActive(user);

  let games = [...(def.games || [])];
  if (def.allowCustomGames && Array.isArray(user.allowedGames) && user.allowedGames.length > 0) {
    games = user.allowedGames.filter(Boolean);
  }

  const inactive = !isActive;

  return {
    tier,
    isActive,
    isAdmin: false,
    games: inactive ? [] : games,
    openBets: inactive ? false : Boolean(def.openBets),
    matchDetails: inactive ? false : Boolean(def.matchDetails),
    gamesTab: inactive ? false : Boolean(def.gamesTab),
    maxDevices: inactive ? 1 : def.maxDevices ?? 1,
    isPremium: inactive ? false : Boolean(def.isPremium),
    smsPoints: user.smsPoints ?? 0,
  };
}

function getSubscriptionInfo(user) {
  const ent = getEntitlements(user);
  return {
    subscription: ent.tier,
    isPremium: ent.isPremium,
    maxDevices: ent.maxDevices,
    isActive: ent.isActive,
    entitlements: ent,
  };
}

function canAccessGame(user, gameId) {
  const ent = getEntitlements(user);
  if (ent.isAdmin) return true;
  if (!ent.isActive) return false;
  return ent.games.includes(gameId);
}

function assertGameAccess(user, gameId) {
  if (canAccessGame(user, gameId)) {
    return { ok: true, user };
  }
  const ent = getEntitlements(user);
  return {
    ok: false,
    status: 403,
    json: {
      success: false,
      error: "Subscription does not include this game",
      requiredGame: gameId,
      subscriptionType: ent.tier,
      allowedGames: ent.games,
    },
  };
}

function listTiersForAdmin() {
  return SUBSCRIPTION_TIERS.map((id) => ({
    id,
    label: TIER_DEFINITIONS[id]?.label || id,
    allowCustomGames: Boolean(TIER_DEFINITIONS[id]?.allowCustomGames),
    smsPointsOnAssign: TIER_DEFINITIONS[id]?.smsPointsOnAssign ?? 0,
  }));
}

function applyTierSideEffects(user, newTier, { previousTier } = {}) {
  const def = TIER_DEFINITIONS[normalizeSubscriptionTier(newTier)];
  if (!def || !user) return;

  if (def.smsPointsOnAssign && previousTier !== newTier) {
    const bonus = def.smsPointsOnAssign;
    user.smsPoints = Math.max(user.smsPoints ?? 0, bonus);
  }

  if (def.allowCustomGames && (!user.allowedGames || user.allowedGames.length === 0)) {
    user.allowedGames = [...(def.games || [])];
  }

  if (!def.allowCustomGames) {
    user.allowedGames = undefined;
  }
}

module.exports = {
  getSubscriptionInfo,
  getEntitlements,
  canAccessGame,
  assertGameAccess,
  isSubscriptionActive,
  listTiersForAdmin,
  applyTierSideEffects,
  normalizeSubscriptionTier,
};
