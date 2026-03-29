const virtualGameService = require("../services/virtualGame.service");
const { sendResult } = require("../http/sendResult");

exports.placeBet = async (req, res) => {
  const result = await virtualGameService.placeBet(req.body);
  sendResult(res, result);
};

exports.listBetsByUser = async (req, res) => {
  const result = await virtualGameService.listBetsByUser(
    req.params.userId,
    req.query
  );
  sendResult(res, result);
};

exports.listBetsByUserAndStatus = async (req, res) => {
  const result = await virtualGameService.listBetsByUserAndStatus(
    req.params.userId,
    req.params.status
  );
  sendResult(res, result);
};

exports.getBetByTicketId = async (req, res) => {
  const result = await virtualGameService.getBetByTicketId(
    req.params.ticketId
  );
  sendResult(res, result);
};

exports.updateBet = async (req, res) => {
  const result = await virtualGameService.updateBet(req.params.ticketId, req.body);
  sendResult(res, result);
};

exports.deleteBet = async (req, res) => {
  const result = await virtualGameService.deleteBet(req.params.ticketId);
  sendResult(res, result);
};
