const express = require("express");
const router = express.Router();
const bankAccountController = require("../src/controllers/bankAccount.controller");

router.get("/bank-accounts/:userId", bankAccountController.listByUser);
router.post("/bank-accounts", bankAccountController.create);
router.put("/bank-accounts/:accountId", bankAccountController.update);
router.delete("/bank-accounts/:accountId", bankAccountController.remove);
router.post("/bank-accounts/sync", bankAccountController.sync);

module.exports = router;
