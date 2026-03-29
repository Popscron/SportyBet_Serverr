const matchesService = require("../services/matches.service");
const { sendResult } = require("../http/sendResult");

exports.saveManyMatches = async (req, res) => {
  const result = await matchesService.saveManyMatches(req.body);
  sendResult(res, result);
};

exports.createSingleMatch = async (req, res) => {
  const result = await matchesService.createSingleMatch(req.body);
  sendResult(res, result);
};

exports.listMatches = async (req, res) => {
  const result = await matchesService.listMatches();
  sendResult(res, result);
};

exports.patchMatch = async (req, res) => {
  const result = await matchesService.patchMatch(req.params.id, req.body);
  sendResult(res, result);
};

exports.patchMatchStatus = async (req, res) => {
  const result = await matchesService.patchMatchStatus(req.params.id, req.body);
  sendResult(res, result);
};
