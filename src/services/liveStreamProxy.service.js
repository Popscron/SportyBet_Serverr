const DEFAULT_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function assertSafeUpstreamUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch (_) {
    const err = new Error("Invalid stream URL");
    err.status = 400;
    throw err;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    const err = new Error("Only http/https stream URLs are allowed");
    err.status = 400;
    throw err;
  }
  if (isPrivateHostname(parsed.hostname)) {
    const err = new Error("Stream host not allowed");
    err.status = 400;
    throw err;
  }
  return parsed.href;
}

function publicBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}`;
}

function buildProxyUrl(req, targetUrl, { referer, ua } = {}) {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  if (ua) params.set("ua", ua);
  return `${publicBaseUrl(req)}/api/live-stream/proxy?${params.toString()}`;
}

function rewritePlaylist(body, playlistUrl, req, headerOpts) {
  const lines = String(body || "").split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        if (!/URI="/i.test(trimmed)) return line;
        return trimmed.replace(/URI="([^"]+)"/gi, (_, uri) => {
          try {
            const abs = new URL(uri, playlistUrl).href;
            return `URI="${buildProxyUrl(req, abs, headerOpts)}"`;
          } catch (_) {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const abs = new URL(trimmed, playlistUrl).href;
        return buildProxyUrl(req, abs, headerOpts);
      } catch (_) {
        return line;
      }
    })
    .join("\n");
}

async function fetchUpstream(targetUrl, { referer, ua } = {}) {
  const headers = {
    "User-Agent": ua || DEFAULT_UA,
    Accept: "*/*",
  };
  if (referer) headers.Referer = referer;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function isPlaylistContentType(contentType, url) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("mpegurl") || ct.includes("m3u8") || ct.includes("text/plain")) {
    return true;
  }
  return /\.m3u8(\?|$)/i.test(String(url || ""));
}

module.exports = {
  assertSafeUpstreamUrl,
  buildProxyUrl,
  rewritePlaylist,
  fetchUpstream,
  isPlaylistContentType,
  DEFAULT_UA,
};
