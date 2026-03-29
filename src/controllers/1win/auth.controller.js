const { validationResult } = require("express-validator");
const authService = require("../../services/1win/auth.service");
const { sendResult } = require("../../http/sendResult");

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await authService.register(req.body);
  sendResult(res, result);
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await authService.login(req.body);
  sendResult(res, result);
};

exports.me = async (req, res) => {
  const result = await authService.me(req.user._id);
  sendResult(res, result);
};

exports.adminLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await authService.adminLogin(req.body);
  sendResult(res, result);
};

exports.getMinePattern = async (req, res) => {
  const result = await authService.getMinePattern(req.user._id);
  sendResult(res, result);
};

exports.generateMinePattern = async (req, res) => {
  const result = await authService.generateMinePattern(req.user._id, req.body);
  sendResult(res, result);
};

exports.getTransactions = async (req, res) => {
  const result = await authService.getTransactions(req.user._id, req.query);
  sendResult(res, result);
};

exports.updateAccountId = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await authService.updateAccountId(req.user._id, req.body);
  sendResult(res, result);
};

exports.getStats = async (req, res) => {
  const result = await authService.getStats();
  sendResult(res, result);
};

exports.validateInvite = async (req, res) => {
  const result = await authService.validateInvite(req.params.code);
  sendResult(res, result);
};

exports.logout = async (req, res) => {
  const result = authService.logout();
  sendResult(res, result);
};
