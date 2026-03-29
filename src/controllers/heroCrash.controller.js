const heroCrashService = require("../services/heroCrash.service");
const { sendResult } = require("../http/sendResult");

exports.getCurrentResult = async (req, res) => {
  const result = await heroCrashService.getCurrentResult();
  sendResult(res, result);
};

exports.markUsed = async (req, res) => {
  const result = await heroCrashService.markUsed(req.body);
  sendResult(res, result);
};

exports.placeBet = async (req, res) => {
  const result = await heroCrashService.placeBet(req.body);
  sendResult(res, result);
};

exports.cashout = async (req, res) => {
  const result = await heroCrashService.cashout(req.body);
  sendResult(res, result);
};

exports.applyCrash = async (req, res) => {
  const result = await heroCrashService.applyCrash(req.body);
  sendResult(res, result);
};

exports.betHistory = async (req, res) => {
  const result = await heroCrashService.betHistory(req.query);
  sendResult(res, result);
};
