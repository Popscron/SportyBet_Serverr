const Otp = require("../../../models/otp");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtp({ mobileNumber }) {
  if (!mobileNumber) {
    return { status: 400, json: { error: "Mobile number is required" } };
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await Otp.findOneAndUpdate(
    { mobileNumber },
    { otp, expiresAt },
    { upsert: true, new: true }
  );
  return {
    status: 200,
    json: { success: true, message: `OTP generated: ${otp}` },
  };
}

async function verifyOtp({ mobileNumber, otp }) {
  const otpRecord = await Otp.findOne({ mobileNumber });
  if (!otpRecord) return { status: 400, json: { error: "Invalid OTP" } };
  if (otpRecord.otp !== otp)
    return { status: 400, json: { error: "Incorrect OTP" } };
  if (new Date() > otpRecord.expiresAt)
    return { status: 400, json: { error: "OTP expired" } };
  return { status: 200, json: { success: true, message: "OTP verified successfully" } };
}

module.exports = { sendOtp, verifyOtp, generateOtp };
