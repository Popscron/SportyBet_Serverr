const jwt = require("jsonwebtoken");
const User = require("../../../models/user");
const Device = require("../../../models/Device");
const { jwtSecret } = require("../../config/auth.config");
const { getSubscriptionInfo } = require("./subscription.helper");

async function adminLogin({ email, password }) {
  try {
    if (!email || email.trim() === "" || !password || password.trim() === "") {
      return {
        status: 400,
        json: { message: "email and password are required." },
      };
    }
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase());
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (
      !adminEmails.includes(email.toLowerCase()) ||
      !adminPassword ||
      password !== adminPassword
    ) {
      return {
        status: 400,
        json: { message: "email or password is wrong." },
      };
    }

    const token = jwt.sign({ email }, jwtSecret, { expiresIn: "7d" });

    return {
      status: 200,
      json: {
        success: true,
        message: "Login successful",
        user: { email },
        token,
      },
      setCookie: {
        name: "sportybetToken",
        value: token,
        options: {
          maxAge: 7 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          sameSite: "none",
          secure: true,
        },
      },
    };
  } catch (error) {
    console.error("Error in admin login", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

function authMe(cookieToken) {
  try {
    if (!cookieToken) {
      return {
        status: 401,
        json: { message: "Unauthorized - No token provided" },
      };
    }
    const decoded = jwt.verify(cookieToken, jwtSecret);
    if (!decoded) {
      return { status: 401, json: { message: "Unauthorized - Invalid token" } };
    }
    return {
      status: 200,
      json: { success: true, user: { email: decoded.email } },
    };
  } catch (error) {
    console.error("Error in getMe controller", error);
    return { status: 500, json: { message: "Internal Server Error" } };
  }
}

async function logout(userId, deviceId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
        clearCookie: true,
      };
    }

    if (deviceId) {
      await Device.findOneAndUpdate(
        { userId, deviceId, isActive: true },
        { isActive: false, lastLogoutAt: new Date() }
      );
    }

    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;

    if (!isPremium) {
      await User.findByIdAndUpdate(userId, { token: null });
      console.log(`[Logout] Token cleared for Games user ${userId}`);
    } else {
      const activeDevices = await Device.find({
        userId,
        isActive: true,
      });

      if (activeDevices.length === 0) {
        await User.findByIdAndUpdate(userId, { token: null });
        console.log(
          `[Logout] Token cleared for Premium user ${userId} (no active devices)`
        );
      } else {
        console.log(
          `[Logout] Token kept for Premium user ${userId} (${activeDevices.length} active device(s) remaining)`
        );
      }
    }

    return {
      status: 200,
      json: { success: true, message: "Logout Successfully" },
      clearCookie: true,
    };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      status: 200,
      json: { success: true, message: "Logout Successfully" },
      clearCookie: true,
    };
  }
}

module.exports = { adminLogin, authMe, logout };
