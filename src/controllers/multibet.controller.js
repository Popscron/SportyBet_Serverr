const multibetService = require("../services/multibet.service");
const { sendResult } = require("../http/sendResult");

exports.createMultibets = async (req, res) => {
  const result = await multibetService.createMultibets(req.body);
  sendResult(res, result);
};

exports.addMatch = async (req, res) => {
  const result = await multibetService.addMatch(req.body);
  sendResult(res, result);
};

exports.addMatch1 = async (req, res) => {
  const result = await multibetService.addMatch1(req.body);
  sendResult(res, result);
};

exports.listByBetUserId = async (req, res) => {
  const result = await multibetService.listByBetUserId(req.params.userId);
  sendResult(res, result);
};

exports.listByRealUserId = async (req, res) => {
  const result = await multibetService.listByRealUserId(req.params.userId1);
  sendResult(res, result);
};

exports.updateMultibet = async (req, res) => {
  const result = await multibetService.updateMultibet(req.params.id, req.body);
  sendResult(res, result);
};

exports.updateMultibetFields = async (req, res) => {
  const result = await multibetService.updateMultibetFields(
    req.params.id,
    req.body
  );
  sendResult(res, result);
};

exports.updateChat = async (req, res) => {
  const result = await multibetService.updateChat(req.params.id, req.body);
  sendResult(res, result);
};

exports.updateLiveOdd = async (req, res) => {
  const result = await multibetService.updateLiveOdd(req.params.id, req.body);
  sendResult(res, result);
};
