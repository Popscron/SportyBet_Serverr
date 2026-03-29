/**
 * Subscription / device-limit helpers (shared by login + legacy auth routes).
 */
function getSubscriptionInfo(user) {
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  const subscription = user.subscription || "Games";

  let isPremium = false;
  let maxDevices = 1;

  if (isActive) {
    if (subscription === "Premium") {
      isPremium = true;
      maxDevices = 999;
    } else if (subscription === "Premium Plus") {
      isPremium = true;
      maxDevices = 2;
    }
  }

  return {
    subscription,
    isPremium,
    maxDevices,
    isActive,
  };
}

module.exports = { getSubscriptionInfo };
