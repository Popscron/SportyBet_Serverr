const cashoutService = require("../services/cashout.service");
const { sendResult } = require("../http/sendResult");

exports.upsertByBetId = async (req, res) => {
  const result = await cashoutService.upsertByBetId(
    req.params.betId,
    req.body
  );
  sendResult(res, result);
};

exports.getByBetId = async (req, res) => {
  const result = await cashoutService.getByBetId(req.params.betId);
  sendResult(res, result);
};

exports.listAll = async (req, res) => {
  const result = await cashoutService.listAll();
  sendResult(res, result);
};
