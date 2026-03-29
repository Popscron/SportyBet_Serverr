const userAddonService = require("../services/userAddon.service");
const { sendResult } = require("../http/sendResult");

exports.buyAddon = async (req, res) => {
  const result = await userAddonService.buyAddon(req.body);
  sendResult(res, result);
};

exports.listAllForUser = async (req, res) => {
  const result = await userAddonService.listAllForUser(req.params.userId);
  sendResult(res, result);
};
