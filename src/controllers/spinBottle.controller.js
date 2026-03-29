const spinBottleService = require("../services/spinBottle.service");
const { sendResult } = require("../http/sendResult");

exports.getCurrentResult = async (req, res) => {
  const result = await spinBottleService.getCurrentResult();
  sendResult(res, result);
};

exports.markUsed = async (req, res) => {
  const result = await spinBottleService.markUsed(req.body);
  sendResult(res, result);
};

exports.placeBet = async (req, res) => {
  const result = await spinBottleService.placeBet(req.body);
  sendResult(res, result);
};

exports.betHistory = async (req, res) => {
  const result = await spinBottleService.betHistory(req.query);
  sendResult(res, result);
};
