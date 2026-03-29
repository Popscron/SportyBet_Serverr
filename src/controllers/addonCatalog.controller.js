const addonCatalogService = require("../services/addonCatalog.service");
const { sendResult } = require("../http/sendResult");

exports.bulkCreate = async (req, res) => {
  const result = await addonCatalogService.bulkCreate(req.body);
  sendResult(res, result);
};

exports.listAll = async (req, res) => {
  const result = await addonCatalogService.listAll();
  sendResult(res, result);
};
