const profileImageService = require("../services/profileImage.service");
const { sendResult } = require("../http/sendResult");

exports.createMany = async (req, res) => {
  const result = await profileImageService.createMany(req.body);
  sendResult(res, result);
};

exports.listAll = async (req, res) => {
  const result = await profileImageService.listAll();
  sendResult(res, result);
};
