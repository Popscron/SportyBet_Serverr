const bcrypt = require("bcryptjs");
const User = require("../../../models/user");
const UserDeactivation = require("../../../models/UserDeactivation");
const MinigenLoginChallenge = require("../../../models/MinigenLoginChallenge");
const {
  createRequestId,
  createLoginCode,
} = require("../../../models/MinigenLoginChallenge");
const { finalizeLogin } = require("./login.service");

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function findUserForLogin(identifier) {
  return User.findOne({
    $or: [
      { email: identifier },
      { username: identifier },
      { mobileNumber: identifier },
    ],
  }).lean();
}

async function validateLoginUser(user) {
  if (!user) {
    return { ok: false, status: 404, body: { success: false, message: "User not found" } };
  }

  const deactivationRecord = await UserDeactivation.findOne({ userId: user._id });
  if (deactivationRecord?.isDeactivated) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        message:
          "Account is deactivated. Please reactivate your account to continue.",
        isDeactivated: true,
        remainingDays: deactivationRecord.remainingSubscriptionDays,
      },
    };
  }

  if (user.accountStatus === "Hold") {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        message:
          "Your account is pending admin approval. Please wait for approval before logging in.",
        requiresApproval: true,
        accountStatus: "Hold",
      },
    };
  }

  return { ok: true, user };
}

/**
 * POST /api/auth/minigen/login-request
 * Validates SportyBet credentials and creates a verification challenge for MiniGen.
 */
async function requestMinigenLogin(req, res) {
  const { identifier, password, deviceInfo } = req.body;

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Both fields are required" });
  }

  try {
    const user = await findUserForLogin(String(identifier).trim());
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const validation = await validateLoginUser(user);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.body);
    }

    await MinigenLoginChallenge.updateMany(
      { userId: user._id, consumed: false },
      { $set: { consumed: true } }
    );

    const requestId = createRequestId();
    const code = createLoginCode();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await MinigenLoginChallenge.create({
      userId: user._id,
      requestId,
      code,
      deviceInfo: deviceInfo || null,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      requiresVerification: true,
      requestId,
      message:
        "Open the SportyBet app on your phone to view the MiniGen login code, then enter it here.",
      expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
    });
  } catch (err) {
    console.error("MiniGen login request error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * GET /api/auth/minigen/pending-code
 * Logged-in SportyBet user polls for an active MiniGen login code.
 */
async function getPendingMinigenCode(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const challenge = await MinigenLoginChallenge.findOne({
      userId,
      consumed: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!challenge) {
      return res.status(200).json({ success: true, hasPending: false });
    }

    const deviceLabel =
      challenge.deviceInfo?.deviceName ||
      challenge.deviceInfo?.modelName ||
      "MiniGen";

    return res.status(200).json({
      success: true,
      hasPending: true,
      requestId: challenge.requestId,
      code: challenge.code,
      deviceLabel,
      message: `MiniGen login code for ${deviceLabel}`,
      expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    console.error("MiniGen pending code error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * POST /api/auth/minigen/verify-login
 * MiniGen submits the code to complete login.
 */
async function verifyMinigenLogin(req, res) {
  const { requestId, code, deviceInfo } = req.body;

  if (!requestId || !code) {
    return res
      .status(400)
      .json({ success: false, message: "Verification code is required" });
  }

  try {
    const challenge = await MinigenLoginChallenge.findOne({
      requestId: String(requestId).trim(),
      consumed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!challenge) {
      return res.status(400).json({
        success: false,
        message: "Login code expired or invalid. Please sign in again.",
      });
    }

    if (String(code).trim() !== challenge.code) {
      return res.status(401).json({
        success: false,
        message: "Incorrect verification code. Check the SportyBet app and try again.",
      });
    }

    challenge.consumed = true;
    await challenge.save();

    const user = await User.findById(challenge.userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const validation = await validateLoginUser(user);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.body);
    }

    const loginDeviceInfo = deviceInfo || challenge.deviceInfo;
    return finalizeLogin(user, loginDeviceInfo, req, res);
  } catch (err) {
    console.error("MiniGen verify login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  requestMinigenLogin,
  getPendingMinigenCode,
  verifyMinigenLogin,
};
