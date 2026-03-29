const spindictService = require("../services/spindict.service");
const { sendResult } = require("../http/sendResult");

exports.login = async (req, res) => {
  const result = await spindictService.login(req.body);
  sendResult(res, result);
};

exports.createTransaction = async (req, res) => {
  const result = await spindictService.createTransaction(req.user._id, req.body);
  sendResult(res, result);
};

exports.listMyTransactions = async (req, res) => {
  const result = await spindictService.listMyTransactions(req.user._id);
  sendResult(res, result);
};

exports.updateTransactionStatus = async (req, res) => {
  const result = await spindictService.updateTransactionStatus(
    req.params.id,
    req.body
  );
  sendResult(res, result);
};

exports.getAdminUsers = async (req, res) => {
  const result = await spindictService.getAdminUsers();
  sendResult(res, result);
};

exports.getAdminPaidUsers = async (req, res) => {
  const result = await spindictService.getAdminPaidUsers();
  sendResult(res, result);
};

exports.getAdminStatistics = async (req, res) => {
  const result = await spindictService.getAdminStatistics();
  sendResult(res, result);
};

exports.getAdminAllTransactions = async (req, res) => {
  const result = await spindictService.getAdminAllTransactions();
  sendResult(res, result);
};
