const manualCardService = require("../services/manualCard.service");
const { sendResult } = require("../http/sendResult");

exports.create = async (req, res) => {
  const result = await manualCardService.create(req.body);
  sendResult(res, result);
};

exports.listActive = async (req, res) => {
  const result = await manualCardService.listActive();
  sendResult(res, result);
};

exports.listForBroadcast = async (req, res) => {
  const result = await manualCardService.listForBroadcast();
  sendResult(res, result);
};

exports.update = async (req, res) => {
  const result = await manualCardService.update(req.params.id, req.body);
  sendResult(res, result);
};

exports.remove = async (req, res) => {
  const result = await manualCardService.remove(req.params.id);
  sendResult(res, result);
};

exports.deactivate = async (req, res) => {
  const result = await manualCardService.deactivate(req.params.id);
  sendResult(res, result);
};

exports.cleanupExpired = async (req, res) => {
  const result = await manualCardService.cleanupExpired();
  sendResult(res, result);
};
