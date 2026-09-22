const aviatorService = require("../services/aviator.service");
const { sendResult } = require("../http/sendResult");

exports.getCurrentResult = async (req, res) => {
  const result = await aviatorService.getCurrentResult();
  sendResult(res, result);
};

exports.markUsed = async (req, res) => {
  const result = await aviatorService.markUsed(req.body);
  sendResult(res, result);
};

exports.placeBet = async (req, res) => {
  const result = await aviatorService.placeBet(req.body);
  sendResult(res, result);
};

exports.cancelBet = async (req, res) => {
  const result = await aviatorService.cancelBet(req.body);
  sendResult(res, result);
};

exports.cashout = async (req, res) => {
  const result = await aviatorService.cashout(req.body);
  sendResult(res, result);
};

exports.applyCrash = async (req, res) => {
  const result = await aviatorService.applyCrash(req.body);
  sendResult(res, result);
};

exports.betHistory = async (req, res) => {
  const result = await aviatorService.betHistory(req.query);
  sendResult(res, result);
};
