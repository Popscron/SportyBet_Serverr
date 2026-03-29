const { validationResult } = require("express-validator");
const adminService = require("../../services/1win/admin.service");
const { sendResult } = require("../../http/sendResult");

exports.getUsers = async (req, res) => {
  const result = await adminService.getUsers();
  sendResult(res, result);
};

exports.getWebsiteUsers = async (req, res) => {
  const result = await adminService.getWebsiteUsers();
  sendResult(res, result);
};

exports.getExpiredUsers = async (req, res) => {
  const result = await adminService.getExpiredUsers();
  sendResult(res, result);
};

exports.getDisabledUsers = async (req, res) => {
  const result = await adminService.getDisabledUsers();
  sendResult(res, result);
};

exports.getUserById = async (req, res) => {
  const result = await adminService.getUserById(req.params.id);
  sendResult(res, result);
};

exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await adminService.createUser(req.body);
  sendResult(res, result);
};

exports.updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Validation errors:", errors.array());
    return sendResult(res, {
      status: 400,
      json: {
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      },
    });
  }
  const result = await adminService.updateUser(req.params.id, req.body);
  sendResult(res, result);
};

exports.deleteUser = async (req, res) => {
  const result = await adminService.deleteUser(req.params.id);
  sendResult(res, result);
};

exports.toggleUserStatus = async (req, res) => {
  const result = await adminService.toggleUserStatus(req.params.id, req.body);
  sendResult(res, result);
};

exports.getAdminsList = async (req, res) => {
  const result = await adminService.getAdminsList();
  sendResult(res, result);
};

exports.getAdminsWithStats = async (req, res) => {
  const result = await adminService.getAdminsWithStats();
  sendResult(res, result);
};

exports.createAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await adminService.createAdmin(req.body);
  sendResult(res, result);
};

exports.updateAdminRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await adminService.updateAdminRole(req.params.id, req.body);
  sendResult(res, result);
};

exports.generateAdminInviteCode = async (req, res) => {
  const result = await adminService.generateAdminInviteCode(req.params.id);
  sendResult(res, result);
};

exports.getAdminStats = async (req, res) => {
  const result = await adminService.getAdminStats(req.params.id);
  sendResult(res, result);
};

exports.getMyInviteLink = async (req, res) => {
  const result = adminService.getMyInviteLink(req.user);
  sendResult(res, result);
};

exports.getMyEarnings = async (req, res) => {
  const result = await adminService.getMyEarnings(req.user._id);
  sendResult(res, result);
};

exports.generateAllInviteCodes = async (req, res) => {
  const result = await adminService.generateAllInviteCodes();
  sendResult(res, result);
};

exports.getMyReferredUsers = async (req, res) => {
  const result = await adminService.getMyReferredUsers(req.user._id);
  sendResult(res, result);
};
