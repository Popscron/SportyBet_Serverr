const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuthMiddleware");
const adminController = require("../src/controllers/admin.controller");

router.get("/test", adminController.test);

router.use(adminAuth);

router.put("/next-update-date", adminController.updateNextUpdateDate);

router.get("/device-requests", adminController.getDeviceRequests);
router.get("/device-requests/:id/devices", adminController.getDeviceRequestActiveDevices);
router.get("/device-requests/:id", adminController.getDeviceRequestById);
router.put("/device-requests/:id/approve", adminController.approveDeviceRequest);
router.put("/device-requests/:id/reject", adminController.rejectDeviceRequest);

router.get("/users/:userId/devices", adminController.getUserDevices);

router.get("/device-deactivation-requests", adminController.getDeviceDeactivationRequests);
router.put(
  "/device-deactivation-requests/:id/approve",
  adminController.approveDeviceDeactivationRequest
);
router.put(
  "/device-deactivation-requests/:id/reject",
  adminController.rejectDeviceDeactivationRequest
);

router.put("/devices/:deviceId/deactivate", adminController.deactivateDevice);

router.post("/load-sms-points", adminController.loadSmsPoints);

router.post("/users/:userId/clear-devices", adminController.clearUserDevices);

module.exports = router;
