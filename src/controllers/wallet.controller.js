const walletService = require("../services/wallet.service");
const { sendResult } = require("../http/sendResult");

exports.deposit = async (req, res) => {
  const result = await walletService.deposit(req.body);
  sendResult(res, result);
};

exports.depositSendSms = async (req, res) => {
  const result = await walletService.depositSendSms(req.body);
  sendResult(res, result);
};

exports.withdraw = async (req, res) => {
  const result = await walletService.withdraw(req.body);
  sendResult(res, result);
};

exports.getHistory = async (req, res) => {
  const result = await walletService.getHistory(req.params.userId, req.query);
  sendResult(res, result);
};

exports.getBalance = async (req, res) => {
  const result = await walletService.getBalance(req.params.userId);
  sendResult(res, result);
};

exports.updateCurrency = async (req, res) => {
  const result = await walletService.updateCurrency(req.body);
  sendResult(res, result);
};

exports.deleteTransaction = async (req, res) => {
  const result = await walletService.deleteTransaction(
    req.params.transactionId
  );
  sendResult(res, result);
};

exports.deleteAllUserTransactions = async (req, res) => {
  const result = await walletService.deleteAllUserTransactions(
    req.params.userId
  );
  sendResult(res, result);
};
