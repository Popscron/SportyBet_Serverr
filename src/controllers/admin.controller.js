const adminService = require("../services/admin.service");
const { sendResult } = require("../http/sendResult");

exports.test = (req, res) => {
  sendResult(res, {
    status: 200,
    json: {
      success: true,
      message: "Admin routes are working",
      path: "/api/admin/test",
    },
  });
};

exports.updateNextUpdateDate = async (req, res) => {
  const result = await adminService.updateNextUpdateDate(req.body);
  sendResult(res, result);
};

exports.getDeviceRequests = async (req, res) => {
  const result = await adminService.getDeviceRequests(req.query);
  sendResult(res, result);
};

exports.getDeviceRequestById = async (req, res) => {
  const result = await adminService.getDeviceRequestById(req.params.id);
  sendResult(res, result);
};

exports.getDeviceRequestActiveDevices = async (req, res) => {
  const result = await adminService.getDeviceRequestActiveDevices(req.params.id);
  sendResult(res, result);
};

exports.approveDeviceRequest = async (req, res) => {
  const result = await adminService.approveDeviceRequest(
    req.params.id,
    req.body,
    req.user
  );
  sendResult(res, result);
};

exports.rejectDeviceRequest = async (req, res) => {
  const result = await adminService.rejectDeviceRequest(
    req.params.id,
    req.body,
    req.user
  );
  sendResult(res, result);
};

exports.getUserDevices = async (req, res) => {
  const result = await adminService.getUserDevices(req.params.userId);
  sendResult(res, result);
};

exports.getDeviceDeactivationRequests = async (req, res) => {
  const result = await adminService.getDeviceDeactivationRequests(req.query);
  sendResult(res, result);
};

exports.approveDeviceDeactivationRequest = async (req, res) => {
  const reviewerId = req.user?.id ?? null;
  const result = await adminService.approveDeviceDeactivationRequest(
    req.params.id,
    reviewerId
  );
  sendResult(res, result);
};

exports.rejectDeviceDeactivationRequest = async (req, res) => {
  const reviewerId = req.user?.id ?? null;
  const result = await adminService.rejectDeviceDeactivationRequest(
    req.params.id,
    req.body,
    reviewerId
  );
  sendResult(res, result);
};

exports.deactivateDevice = async (req, res) => {
  const result = await adminService.deactivateDeviceById(req.params.deviceId);
  sendResult(res, result);
};

exports.loadSmsPoints = async (req, res) => {
  const result = await adminService.loadSmsPoints(req.body);
  sendResult(res, result);
};

exports.clearUserDevices = async (req, res) => {
  const result = await adminService.clearUserDevices(req.params.userId);
  sendResult(res, result);
};
