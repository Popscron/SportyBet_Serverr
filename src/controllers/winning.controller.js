const winningService = require("../services/winning.service");
const { sendResult } = require("../http/sendResult");

exports.postWinning = async (req, res) => {
  const result = await winningService.postWinning(req.body);
  sendResult(res, result);
};
