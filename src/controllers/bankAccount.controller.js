const bankAccountService = require("../services/bankAccount.service");
const { sendResult } = require("../http/sendResult");

exports.listByUser = async (req, res) => {
  const result = await bankAccountService.listByUser(req.params.userId);
  sendResult(res, result);
};

exports.create = async (req, res) => {
  const result = await bankAccountService.create(req.body);
  sendResult(res, result);
};

exports.update = async (req, res) => {
  const result = await bankAccountService.update(req.params.accountId, req.body);
  sendResult(res, result);
};

exports.remove = async (req, res) => {
  const result = await bankAccountService.remove(req.params.accountId, req.body);
  sendResult(res, result);
};

exports.sync = async (req, res) => {
  const result = await bankAccountService.sync(req.body);
  sendResult(res, result);
};
