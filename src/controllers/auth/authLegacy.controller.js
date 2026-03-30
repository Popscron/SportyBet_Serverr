const otpService = require("../../services/auth/otp.service");
const registerService = require("../../services/auth/register.service");
const profileService = require("../../services/auth/profile.service");
const deviceService = require("../../services/auth/device.service");
const sessionService = require("../../services/auth/session.service");
const adminUsersService = require("../../services/auth/adminUsers.service");
const notificationsService = require("../../services/auth/notifications.service");
const grandAuditService = require("../../services/auth/grandAudit.service");
const deactivationService = require("../../services/auth/deactivation.service");
const passwordService = require("../../services/auth/password.service");

function send(res, result) {
  res.status(result.status).json(result.json);
}

const COOKIE_CLEAR = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  ...(process.env.ADMIN_COOKIE_DOMAIN
    ? { domain: process.env.ADMIN_COOKIE_DOMAIN }
    : {}),
};

exports.sendOtp = async (req, res) => {
  const result = await otpService.sendOtp(req.body);
  send(res, result);
};

exports.verifyOtp = async (req, res) => {
  const result = await otpService.verifyOtp(req.body);
  send(res, result);
};

exports.register = async (req, res) => {
  const result = await registerService.register(req.body);
  send(res, result);
};

exports.getProfile = async (req, res) => {
  const result = await profileService.getProfile(req.user.id);
  send(res, result);
};

exports.getProfileStats = async (req, res) => {
  const result = await profileService.getProfileStats(req.user.id);
  send(res, result);
};

exports.updateProfileStats = async (req, res) => {
  const result = await profileService.updateProfileStats(
    req.user.id,
    req.body
  );
  send(res, result);
};

exports.listUserDevices = async (req, res) => {
  const result = await profileService.listUserDevices(req.user.id);
  send(res, result);
};

exports.createDeviceRequest = async (req, res) => {
  const result = await deviceService.createDeviceRequestWithCredentials(
    req.body,
    req.ip
  );
  send(res, result);
};

exports.listDeviceRequests = async (req, res) => {
  const result = await deviceService.listDeviceRequests(
    req.user.id,
    req.query
  );
  send(res, result);
};

exports.getDeviceRequest = async (req, res) => {
  const result = await deviceService.getDeviceRequest(
    req.user.id,
    req.params.id
  );
  send(res, result);
};

exports.deviceDeactivationRequest = async (req, res) => {
  const result = await deviceService.createDeactivationRequest(
    req.user.id,
    req.params.deviceId
  );
  send(res, result);
};

exports.deactivateDevice = async (req, res) => {
  const result = await deviceService.deactivateDevice(
    req.user.id,
    req.params.deviceId
  );
  send(res, result);
};

exports.updateUserIcon = async (req, res) => {
  const result = await profileService.updateUserIcon(req.body);
  send(res, result);
};

exports.updateName = async (req, res) => {
  console.log("Received Request Body:", req.body);
  const result = await profileService.updateName(req.body);
  send(res, result);
};

exports.adminLogin = async (req, res) => {
  const result = await sessionService.adminLogin(req.body);
  if (result.setCookie) {
    const { name, value, options } = result.setCookie;
    res.cookie(name, value, options);
  }
  res.status(result.status).json(result.json);
};

exports.authMe = async (req, res) => {
  const result = sessionService.authMe(req.cookies.sportybetToken);
  send(res, result);
};

exports.logout = async (req, res) => {
  const deviceId =
    req.body.deviceId || req.headers["x-device-id"];
  const result = await sessionService.logout(req.user.id, deviceId);
  if (result.clearCookie) {
    res.clearCookie("sportybetToken", COOKIE_CLEAR);
  }
  res.status(result.status).json(result.json);
};

exports.getAllUsers = async (req, res) => {
  const result = await adminUsersService.getAllUsers();
  send(res, result);
};

exports.deleteUser = async (req, res) => {
  const result = await adminUsersService.deleteUser(req.params.id);
  send(res, result);
};

exports.getAllUsersByStatus = async (req, res) => {
  const result = await adminUsersService.getAllUsersByStatus();
  send(res, result);
};

exports.disableUserAccountStatus = async (req, res) => {
  const result = await adminUsersService.disableUserAccountStatus(
    req.params.id
  );
  send(res, result);
};

exports.activeUserAccountStatus = async (req, res) => {
  const result = await adminUsersService.activeUserAccountStatus(
    req.params.id
  );
  send(res, result);
};

exports.getExpiredUsers = async (req, res) => {
  const result = await adminUsersService.getExpiredUsers();
  send(res, result);
};

exports.activeUserAccount = async (req, res) => {
  const result = await adminUsersService.activeUserAccount(
    req.params.id,
    req.body
  );
  send(res, result);
};

exports.getUserById = async (req, res) => {
  const result = await profileService.getUserById(req.params.id);
  send(res, result);
};

exports.updateAccountStatus = async (req, res) => {
  const result = await profileService.updateAccountStatus(
    req.params.userId,
    req.body.status
  );
  send(res, result);
};

exports.updateProfile = async (req, res) => {
  const result = await profileService.updateProfile(req.body);
  send(res, result);
};

exports.updateNotificationSettings = async (req, res) => {
  const result = await notificationsService.updateNotificationSettings(
    req.body
  );
  send(res, result);
};

exports.getSmsPoints = async (req, res) => {
  const result = await notificationsService.getSmsPoints(req.query.userId);
  send(res, result);
};

exports.updateUserFields = async (req, res) => {
  const result = await adminUsersService.updateUserFields(req.body);
  send(res, result);
};

exports.updateGrandAuditLimit = async (req, res) => {
  const result = await grandAuditService.updateGrandAuditLimit(req.body);
  send(res, result);
};

exports.deactivateAccount = async (req, res) => {
  const result = await deactivationService.deactivateAccount(req.user.id);
  send(res, result);
};

exports.reactivateAccount = async (req, res) => {
  const result = await deactivationService.reactivateAccount(req.body);
  send(res, result);
};

exports.deactivationStatus = async (req, res) => {
  const result = await deactivationService.getDeactivationStatus(
    req.user.id
  );
  send(res, result);
};

exports.passwordChangeRequest = async (req, res) => {
  const result = await passwordService.requestPasswordChange(req.body);
  send(res, result);
};

exports.adminPasswordChangeRequests = async (req, res) => {
  const result = await passwordService.listPasswordChangeRequests(req.query);
  send(res, result);
};

exports.adminPasswordChangeApprove = async (req, res) => {
  const result = await passwordService.approvePasswordChangeRequest(
    req.params.id
  );
  send(res, result);
};

exports.adminPasswordChangeReject = async (req, res) => {
  const result = await passwordService.rejectPasswordChangeRequest(
    req.params.id,
    req.body
  );
  send(res, result);
};

exports.adminSetUserPassword = async (req, res) => {
  const result = await passwordService.adminSetUserPassword(
    req.params.userId,
    req.body
  );
  send(res, result);
};

exports.userChangePassword = async (req, res) => {
  const result = await passwordService.userChangePassword(req.user.id, req.body);
  send(res, result);
};
