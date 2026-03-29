const betService = require("../services/bet.service");
const { sendResult } = require("../http/sendResult");

exports.listAllBets = async (req, res) => {
  const result = await betService.listAllBets();
  sendResult(res, result);
};

exports.listBetsByUser = async (req, res) => {
  const result = await betService.listBetsByUser(req.params.userId);
  sendResult(res, result);
};

exports.getByBookingCode = async (req, res) => {
  const result = await betService.getByBookingCode(req.params.bookingCode);
  sendResult(res, result);
};

exports.createBet = async (req, res) => {
  const result = await betService.createBet(req.body);
  sendResult(res, result);
};

exports.createBet1 = async (req, res) => {
  const result = await betService.createBet1(req.body);
  sendResult(res, result);
};

exports.updateBetOdd = async (req, res) => {
  const result = await betService.updateBetOdd(req.params.betId, req.body);
  sendResult(res, result);
};

exports.updateTicketFields = async (req, res) => {
  const result = await betService.updateTicketFields(req.params.betId, req.body);
  sendResult(res, result);
};

exports.updateBookingCode = async (req, res) => {
  const result = await betService.updateBookingCode(req.params.betId, req.body);
  sendResult(res, result);
};

exports.deleteBet = async (req, res) => {
  const result = await betService.deleteBet(req.params.betId);
  sendResult(res, result);
};

exports.deleteAllBetsForUser = async (req, res) => {
  const result = await betService.deleteAllBetsForUser(req.params.userId);
  sendResult(res, result);
};
