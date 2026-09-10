const liveStreamProxyService = require("../services/liveStreamProxy.service");

async function proxyLiveStream(req, res) {
  try {
    const targetUrl = liveStreamProxyService.assertSafeUpstreamUrl(req.query.url);
    const referer = req.query.referer ? String(req.query.referer) : "";
    const ua = req.query.ua
      ? String(req.query.ua)
      : liveStreamProxyService.DEFAULT_UA;
    const headerOpts = { referer, ua };

    const upstream = await liveStreamProxyService.fetchUpstream(targetUrl, headerOpts);
    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({
        success: false,
        message: `Upstream stream returned ${upstream.status}`,
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    const treatAsPlaylist = liveStreamProxyService.isPlaylistContentType(
      contentType,
      targetUrl
    );

    if (treatAsPlaylist) {
      const text = await upstream.text();
      // Only rewrite real HLS playlists.
      if (String(text).trim().startsWith("#EXTM3U")) {
        const rewritten = liveStreamProxyService.rewritePlaylist(
          text,
          targetUrl,
          req,
          headerOpts
        );
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        return res.status(200).send(rewritten);
      }
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader(
      "Content-Type",
      contentType || "application/octet-stream"
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (upstream.headers.get("content-length")) {
      res.setHeader("Content-Length", buffer.length);
    }
    return res.status(200).send(buffer);
  } catch (err) {
    const status = err.status || (err.name === "AbortError" ? 504 : 500);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to proxy live stream",
    });
  }
}

module.exports = {
  proxyLiveStream,
};
