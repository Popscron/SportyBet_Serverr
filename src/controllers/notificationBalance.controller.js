const notificationBalanceService = require("../services/notificationBalance.service");
const { sendResult } = require("../http/sendResult");

exports.getBalance = async (req, res) => {
  const result = await notificationBalanceService.getBalance(req.params.userId);
  sendResult(res, result);
};

exports.updateBalance = async (req, res) => {
  const result = await notificationBalanceService.updateBalance(req.body);
  sendResult(res, result);
};
