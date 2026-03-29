const express = require("express");
const router = express.Router();
const smsController = require("../src/controllers/sms.controller");

router.post("/send", smsController.send);
router.post("/send-bulk", smsController.sendBulk);
router.get("/verify-config", smsController.verifyConfig);
router.post("/test", smsController.sendTest);
router.post("/send-otp", smsController.sendOtp);
router.post("/verify-otp", smsController.verifyOtp);

module.exports = router;
