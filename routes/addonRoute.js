const express = require("express");
const router = express.Router();
const addonCatalogController = require("../src/controllers/addonCatalog.controller");

router.post("/addons/bulk", addonCatalogController.bulkCreate);
router.get("/addons", addonCatalogController.listAll);

module.exports = router;
