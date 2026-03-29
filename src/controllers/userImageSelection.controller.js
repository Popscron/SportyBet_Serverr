const userImageSelectionService = require("../services/userImageSelection.service");
const { sendResult } = require("../http/sendResult");

exports.listProfileImages = async (req, res) => {
  const result = await userImageSelectionService.listProfileImages();
  sendResult(res, result);
};

exports.setUserImage = async (req, res) => {
  const result = await userImageSelectionService.setUserImage(
    req.params.userId,
    req.body
  );
  sendResult(res, result);
};

exports.getUserImage = async (req, res) => {
  const result = await userImageSelectionService.getUserImage(
    req.params.userId
  );
  sendResult(res, result);
};
