const express = require("express");
const router = express.Router();
const spindictAuthMiddleware = require("../middleware/spindictAuthMiddleware");
const requireSpindictAdmin = require("../middleware/spindictAdminMiddleware");
const spindictController = require("../src/controllers/spindict.controller");

router.post("/login", spindictController.login);

router.post(
  "/transactions",
  spindictAuthMiddleware,
  spindictController.createTransaction
);
router.get(
  "/transactions",
  spindictAuthMiddleware,
  spindictController.listMyTransactions
);

router.put(
  "/transactions/:id/status",
  spindictAuthMiddleware,
  requireSpindictAdmin,
  spindictController.updateTransactionStatus
);

router.get(
  "/admin/users",
  spindictAuthMiddleware,
  requireSpindictAdmin,
  spindictController.getAdminUsers
);
router.get(
  "/admin/paid-users",
  spindictAuthMiddleware,
  requireSpindictAdmin,
  spindictController.getAdminPaidUsers
);
router.get(
  "/admin/statistics",
  spindictAuthMiddleware,
  requireSpindictAdmin,
  spindictController.getAdminStatistics
);
router.get(
  "/admin/transactions",
  spindictAuthMiddleware,
  requireSpindictAdmin,
  spindictController.getAdminAllTransactions
);

module.exports = router;
