const nextUpdateService = require("../services/nextUpdate.service");
const { sendResult } = require("../http/sendResult");

exports.getNextUpdateDate = async (req, res) => {
  const result = await nextUpdateService.getNextUpdateDate();
  sendResult(res, result);
};

exports.initialize = async (req, res) => {
  const result = await nextUpdateService.initialize(req.body);
  sendResult(res, result);
};
