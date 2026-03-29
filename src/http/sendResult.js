/**
 * Send a service result `{ status, json }` on an Express response.
 */
function sendResult(res, result) {
  res.status(result.status).json(result.json);
}

module.exports = { sendResult };
