const smsService = require("../services/sms.service");
const { sendResult } = require("../http/sendResult");

exports.send = async (req, res) => {
  const result = await smsService.send(req.body);
  sendResult(res, result);
};

exports.sendBulk = async (req, res) => {
  const result = await smsService.sendBulk(req.body);
  sendResult(res, result);
};

exports.verifyConfig = (req, res) => {
  const result = smsService.verifyConfig();
  sendResult(res, result);
};

exports.sendTest = async (req, res) => {
  const result = await smsService.sendTest(req.body);
  sendResult(res, result);
};

exports.sendOtp = async (req, res) => {
  const result = await smsService.sendOtp(req.body);
  sendResult(res, result);
};

exports.verifyOtp = async (req, res) => {
  const result = await smsService.verifyOtp(req.body);
  sendResult(res, result);
};
