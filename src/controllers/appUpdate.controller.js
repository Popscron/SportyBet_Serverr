const appUpdateService = require("../services/appUpdate.service");
const { sendResult } = require("../http/sendResult");

exports.getPublicConfig = async (req, res) => {
  const result = await appUpdateService.getPublicConfig(req.query.appVersion);
  sendResult(res, result);
};

exports.getAdminConfig = async (req, res) => {
  const result = await appUpdateService.getAdminConfig();
  sendResult(res, result);
};

exports.updateAdminConfig = async (req, res) => {
  const result = await appUpdateService.updateAdminConfig(req.body);
  sendResult(res, result);
};
