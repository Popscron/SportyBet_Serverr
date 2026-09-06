/**
 * Expo push helper — same host SportyBet already uses in pushRoutes.js.
 */
function isExpoPushToken(token) {
  if (typeof token !== "string") return false;
  const t = token.trim();
  return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
}

function isDeviceNotRegistered(result) {
  const ticket = result?.data;
  const err =
    ticket?.details?.error ||
    ticket?.error ||
    (Array.isArray(ticket) ? ticket[0]?.details?.error : null);
  return err === "DeviceNotRegistered";
}

async function sendExpoPush({ to, title, body, data, channelId }) {
  if (!isExpoPushToken(to)) {
    return { skipped: true };
  }

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: to.trim(),
      sound: "default",
      title,
      body,
      data: data || {},
      ...(channelId ? { channelId } : {}),
    }),
  });

  return res.json();
}

module.exports = {
  isExpoPushToken,
  isDeviceNotRegistered,
  sendExpoPush,
};
