const { validationResult } = require("express-validator");
const paymentsService = require("../../services/1win/payments.service");
const { sendResult } = require("../../http/sendResult");

exports.createPayment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await paymentsService.createPayment(req.user._id, req.body);
  sendResult(res, result);
};

exports.smsWebhook = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await paymentsService.smsWebhook(req.body);
  sendResult(res, result);
};

exports.getPaymentStatus = async (req, res) => {
  const result = await paymentsService.getPaymentStatus(
    req.user._id,
    req.params.reference
  );
  sendResult(res, result);
};

exports.verifyTransaction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await paymentsService.verifyTransaction(req.user._id, req.body);
  sendResult(res, result);
};

exports.completePayment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResult(res, {
      status: 400,
      json: { success: false, errors: errors.array() },
    });
  }
  const result = await paymentsService.completePayment(req.user._id, req.body);
  sendResult(res, result);
};

exports.getMyPayments = async (req, res) => {
  const result = await paymentsService.getMyPayments(req.user._id);
  sendResult(res, result);
};

exports.cancelPayment = async (req, res) => {
  const result = await paymentsService.cancelPayment(
    req.user._id,
    req.params.reference
  );
  sendResult(res, result);
};
