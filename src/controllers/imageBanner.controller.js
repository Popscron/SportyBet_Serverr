const imageBannerService = require("../services/imageBanner.service");
const { sendResult } = require("../http/sendResult");

exports.uploadImages = async (req, res) => {
  const result = await imageBannerService.uploadImages(req.files);
  sendResult(res, result);
};

exports.uploadSingleImage = async (req, res) => {
  const result = await imageBannerService.uploadSingleImage(req.file, req.body);
  sendResult(res, result);
};

exports.getImages = async (req, res) => {
  const result = await imageBannerService.getImages();
  sendResult(res, result);
};
