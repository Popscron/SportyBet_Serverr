const redBlackService = require("../services/redBlack.service");
const { sendResult } = require("../http/sendResult");

exports.startRound = async (req, res) => {
  const result = await redBlackService.startRound(req.body);
  sendResult(res, result);
};

exports.getRound = async (req, res) => {
  const result = await redBlackService.getRound(req.query);
  sendResult(res, result);
};

exports.playHand = async (req, res) => {
  const result = await redBlackService.playHand(req.body);
  sendResult(res, result);
};

exports.endRound = async (req, res) => {
  const result = await redBlackService.endRound(req.body);
  sendResult(res, result);
};

exports.betHistory = async (req, res) => {
  const result = await redBlackService.betHistory(req.query);
  sendResult(res, result);
};
