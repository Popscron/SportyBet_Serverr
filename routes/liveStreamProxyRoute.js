const express = require("express");
const router = express.Router();
const liveStreamProxyController = require("../src/controllers/liveStreamProxy.controller");

/**
 * Proxies HLS playlists/segments with upstream Referer/User-Agent so mobile
 * clients can play http/referer streams over the API's HTTPS host.
 *
 * GET /api/live-stream/proxy?url=...&referer=...&ua=...
 */
router.get("/live-stream/proxy", liveStreamProxyController.proxyLiveStream);

module.exports = router;
