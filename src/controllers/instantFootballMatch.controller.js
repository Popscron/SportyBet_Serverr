const instantFootballMatchService = require("../services/instantFootballMatch.service");
const { sendResult } = require("../http/sendResult");

exports.listMatches = async (req, res) => {
  const result = await instantFootballMatchService.listMatches();
  sendResult(res, result);
};

exports.createMatch = async (req, res) => {
  const result = await instantFootballMatchService.createMatch(
    req.body,
    req.files
  );
  sendResult(res, result);
};

exports.updateMatch = async (req, res) => {
  const result = await instantFootballMatchService.updateMatch(
    req.params.id,
    req.body
  );
  sendResult(res, result);
};

exports.deleteMatch = async (req, res) => {
  const result = await instantFootballMatchService.deleteMatch(req.params.id);
  sendResult(res, result);
};
