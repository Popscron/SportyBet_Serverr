const depositService = require("../services/deposit.service");
const { sendResult } = require("../http/sendResult");

exports.postDeposit = async (req, res) => {
  const result = await depositService.postDeposit(req.body);
  sendResult(res, result);
};

exports.listByUser = async (req, res) => {
  const result = await depositService.listByUser(req.params.userId);
  sendResult(res, result);
};

exports.withdraw = async (req, res) => {
  const result = await depositService.withdraw(req.body);
  sendResult(res, result);
};

exports.updateCurrency = async (req, res) => {
  const result = await depositService.updateCurrency(req.body);
  sendResult(res, result);
};
