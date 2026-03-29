const oddService = require("../services/odd.service");
const { sendResult } = require("../http/sendResult");

exports.getByBetId = async (req, res) => {
  const result = await oddService.getByBetId(req.params.betId);
  if (result.status === 204) {
    return res.status(204).end();
  }
  sendResult(res, result);
};

exports.upsertByBetId = async (req, res) => {
  const result = await oddService.upsertByBetId(req.params.betId, req.body);
  sendResult(res, result);
};
