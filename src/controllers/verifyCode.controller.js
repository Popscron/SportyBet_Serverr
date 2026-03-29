const verifyCodeService = require("../services/verifyCode.service");
const { sendResult } = require("../http/sendResult");

exports.getOrCreateByBetId = async (req, res) => {
  const result = await verifyCodeService.getOrCreateByBetId(req.params.betId);
  sendResult(res, result);
};

exports.upsertByBetId = async (req, res) => {
  const result = await verifyCodeService.upsertByBetId(
    req.params.betId,
    req.body
  );
  sendResult(res, result);
};

exports.deleteByBetId = async (req, res) => {
  const result = await verifyCodeService.deleteByBetId(req.params.betId);
  sendResult(res, result);
};

exports.getMatchByVerifyCode = async (req, res) => {
  const result = await verifyCodeService.getMatchByVerifyCode(
    req.params.verifyCode
  );
  sendResult(res, result);
};
