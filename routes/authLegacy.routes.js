/**
 * Legacy auth API surface — wired to controllers + services.
 * Route order preserved: specific `/user/...` paths before `/user/:id`.
 */
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const c = require("../src/controllers/auth/authLegacy.controller");

const router = express.Router();

router.post("/send-otp", c.sendOtp);
router.post("/verify-otp", c.verifyOtp);
router.post("/register", c.register);

router.get("/user/profile", authMiddleware, c.getProfile);
router.get("/user/profile-stats", authMiddleware, c.getProfileStats);
router.put("/user/profile-stats", authMiddleware, c.updateProfileStats);
router.get("/user/devices", authMiddleware, c.listUserDevices);

router.post("/user/create-device-request", c.createDeviceRequest);
router.get("/user/device-requests", authMiddleware, c.listDeviceRequests);
router.get("/user/device-requests/:id", authMiddleware, c.getDeviceRequest);
router.post(
  "/user/devices/:deviceId/deactivation-request",
  authMiddleware,
  c.deviceDeactivationRequest
);
router.put(
  "/user/devices/:deviceId/deactivate",
  authMiddleware,
  c.deactivateDevice
);

router.put("/update-user-icon", c.updateUserIcon);
router.put("/update-name", c.updateName);

router.post("/admin/login", c.adminLogin);
router.get("/auth/me", c.authMe);
router.post("/auth/logout", authMiddleware, c.logout);

router.get("/admin/getAllUsers", c.getAllUsers);
router.delete("/admin/deleteUser/:id", c.deleteUser);
router.get("/admin/getAllUsersByStatus", c.getAllUsersByStatus);
router.put("/admin/disableUserAccountStatus/:id", c.disableUserAccountStatus);
router.put("/admin/activeUserAccountStatus/:id", c.activeUserAccountStatus);
router.get("/admin/getExpiredUsers", c.getExpiredUsers);
router.put("/admin/activeUserAccount/:id", c.activeUserAccount);

router.patch("/update-status/:userId", c.updateAccountStatus);
router.post("/update-profile", c.updateProfile);

router.put("/user/notification-settings", c.updateNotificationSettings);
router.get("/user/sms-points", c.getSmsPoints);

router.put("/admin/updateUserFields", c.updateUserFields);
router.put("/update-grand-audit-limit", c.updateGrandAuditLimit);

router.put("/deactivate-account", authMiddleware, c.deactivateAccount);
router.put("/reactivate-account", c.reactivateAccount);
router.get("/deactivation-status", authMiddleware, c.deactivationStatus);

router.post("/password-change/request", c.passwordChangeRequest);
router.get("/admin/password-change/requests", c.adminPasswordChangeRequests);
router.put("/admin/password-change/approve/:id", c.adminPasswordChangeApprove);
router.put("/admin/password-change/reject/:id", c.adminPasswordChangeReject);
router.put("/admin/set-user-password/:userId", c.adminSetUserPassword);
router.put("/user/change-password", authMiddleware, c.userChangePassword);

router.get("/user/:id", c.getUserById);

module.exports = router;
