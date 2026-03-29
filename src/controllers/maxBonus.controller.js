const maxBonusService = require("../services/maxBonus.service");
const { sendResult } = require("../http/sendResult");

exports.listByUser = async (req, res) => {
  const result = await maxBonusService.listByUser(req.query);
  sendResult(res, result);
};

exports.getByBookingCode = async (req, res) => {
  const result = await maxBonusService.getByBookingCode(req.query);
  sendResult(res, result);
};

exports.create = async (req, res) => {
  const result = await maxBonusService.create(req.body);
  sendResult(res, result);
};

exports.update = async (req, res) => {
  const result = await maxBonusService.update(req.params.id, req.body);
  sendResult(res, result);
};

exports.remove = async (req, res) => {
  const result = await maxBonusService.remove(req.params.id);
  sendResult(res, result);
};
