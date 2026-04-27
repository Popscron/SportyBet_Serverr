const imageBannerService = require("../services/imageBanner.service");
const { sendResult } = require("../http/sendResult");

exports.uploadImages = async (req, res) => {
  const result = await imageBannerService.uploadImages(req.files);
  sendResult(res, result);
};

exports.uploadSingleImage = async (req, res) => {
  // Merge multipart body + query fallback so append/title flags survive
  // across different client/form-data implementations.
  const payload = { ...(req.query || {}), ...(req.body || {}) };
  const result = await imageBannerService.uploadSingleImage(req.file, payload);
  sendResult(res, result);
};

exports.getImages = async (req, res) => {
  const result = await imageBannerService.getImages();
  sendResult(res, result);
};
