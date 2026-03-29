const {
  sendSMS,
  sendBulkSMS,
  verifyTwilioConfig,
} = require("../../utils/smsService");
const User = require("../../models/user");
const Otp = require("../../models/otp");

const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(phone);
    }
  }
}, 5 * 60 * 1000);

async function send(body) {
  try {
    const { to, message } = body;

    if (!to) {
      return {
        status: 400,
        json: { success: false, error: "Phone number (to) is required" },
      };
    }

    if (!message) {
      return {
        status: 400,
        json: { success: false, error: "Message is required" },
      };
    }

    const result = await sendSMS(to, message);

    if (result.success) {
      return {
        status: 200,
        json: {
          success: true,
          data: result,
          message: "SMS sent successfully",
        },
      };
    }
    return {
      status: 500,
      json: {
        success: false,
        error: result.error,
        code: result.code,
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/send:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to send SMS. Please try again later.",
        message: "Internal server error",
      },
    };
  }
}

async function sendBulk(body) {
  try {
    const { recipients, message } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Recipients must be a non-empty array",
        },
      };
    }

    if (!message) {
      return {
        status: 400,
        json: { success: false, error: "Message is required" },
      };
    }

    const results = await sendBulkSMS(recipients, message);

    return {
      status: 200,
      json: {
        success: true,
        data: results,
        message: `SMS sent to ${results.length} recipient(s)`,
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/send-bulk:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to send SMS. Please try again later.",
        message: "Internal server error",
      },
    };
  }
}

function verifyConfig() {
  try {
    const configStatus = verifyTwilioConfig();

    return {
      status: 200,
      json: {
        success: true,
        data: configStatus,
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/verify-config:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to verify SMS service configuration.",
        message: "Internal server error",
      },
    };
  }
}

async function sendTest(body) {
  try {
    const { to } = body;

    const testMessage = `🧪 Test SMS from SportyBet App
Time: ${new Date().toLocaleString()}
This is a test message to verify SMS service integration is working correctly.`;

    if (!to) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Phone number (to) is required for test",
        },
      };
    }

    const result = await sendSMS(to, testMessage);

    if (result.success) {
      return {
        status: 200,
        json: {
          success: true,
          data: result,
          message: "Test SMS sent successfully! Check your phone.",
        },
      };
    }
    return {
      status: 500,
      json: {
        success: false,
        error: result.error,
        code: result.code,
        message: "Failed to send test SMS",
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/test:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to send test SMS. Please try again later.",
        message: "Internal server error",
      },
    };
  }
}

async function sendOtp(body) {
  try {
    const { userId, phoneNumber } = body;

    if (!userId) {
      return {
        status: 400,
        json: { success: false, error: "User ID is required" },
      };
    }

    if (!phoneNumber) {
      return {
        status: 400,
        json: { success: false, error: "Phone number is required" },
      };
    }

    const normalizedPhoneNumber = phoneNumber.trim();
    console.log(
      `📱 Send OTP - Original: "${phoneNumber}", Normalized: "${normalizedPhoneNumber}"`
    );

    if (!normalizedPhoneNumber.startsWith("+")) {
      return {
        status: 400,
        json: {
          success: false,
          error:
            "Invalid phone number format. Phone number must be in E.164 format (e.g., +1234567890)",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, error: "User not found" } };
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const expiresAtDate = new Date(expiresAt);

    otpStore.set(normalizedPhoneNumber, { otp, expiresAt, userId });

    try {
      await Otp.findOneAndUpdate(
        { mobileNumber: normalizedPhoneNumber },
        {
          otp,
          expiresAt: expiresAtDate,
          userId: userId.toString(),
        },
        { upsert: true, new: true }
      );
      console.log(`✅ OTP stored in database for: "${normalizedPhoneNumber}"`);
    } catch (dbError) {
      console.error(`⚠️ Failed to store OTP in database:`, dbError.message);
    }

    console.log(
      `✅ OTP stored for: "${normalizedPhoneNumber}", OTP: ${otp}, Expires at: ${expiresAtDate.toISOString()}`
    );
    console.log(
      `📊 Current OTP store size: ${otpStore.size}, Keys:`,
      Array.from(otpStore.keys())
    );

    const message = `Your Mini verification code is: ${otp}\n\nThis code will expire in 10 minutes. Thank you for choosing us `;
    const result = await sendSMS(normalizedPhoneNumber, message);

    if (result.success) {
      return {
        status: 200,
        json: {
          success: true,
          message: "OTP sent successfully",
          expiresIn: 10 * 60,
        },
      };
    }
    return {
      status: 500,
      json: {
        success: false,
        error: result.error,
        code: result.code,
        message: "Failed to send OTP",
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/send-otp:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to send OTP. Please try again later.",
        message: "Internal server error",
      },
    };
  }
}

async function verifyOtp(body) {
  try {
    const { userId, phoneNumber, otp } = body;

    if (!userId || !phoneNumber || !otp) {
      return {
        status: 400,
        json: {
          success: false,
          error: "User ID, phone number, and OTP are required",
        },
      };
    }

    const normalizedPhoneNumber = phoneNumber.trim();
    console.log(
      `🔍 Verify OTP - Original: "${phoneNumber}", Normalized: "${normalizedPhoneNumber}", OTP: ${otp}`
    );
    console.log(
      `📊 Current OTP store size: ${otpStore.size}, Keys:`,
      Array.from(otpStore.keys())
    );

    let storedData = otpStore.get(normalizedPhoneNumber);

    if (!storedData) {
      console.log(`🔍 OTP not in memory, checking database...`);
      try {
        const dbOtp = await Otp.findOne({ mobileNumber: normalizedPhoneNumber });
        if (dbOtp) {
          if (new Date() > dbOtp.expiresAt) {
            await Otp.findOneAndDelete({ mobileNumber: normalizedPhoneNumber });
            return {
              status: 400,
              json: {
                success: false,
                error: "OTP has expired. Please request a new OTP.",
              },
            };
          }
          storedData = {
            otp: dbOtp.otp,
            expiresAt: dbOtp.expiresAt.getTime(),
            userId: dbOtp.userId || userId,
          };
          console.log(`✅ OTP found in database for: "${normalizedPhoneNumber}"`);
        }
      } catch (dbError) {
        console.error(`⚠️ Error checking database for OTP:`, dbError.message);
      }
    }

    if (!storedData) {
      console.error(`❌ OTP not found for: "${normalizedPhoneNumber}"`);
      console.error(`🔍 Available keys in store:`, Array.from(otpStore.keys()));
      return {
        status: 400,
        json: {
          success: false,
          error: "OTP not found or expired. Please request a new OTP.",
        },
      };
    }

    console.log(
      `✅ OTP found for: "${normalizedPhoneNumber}", Stored OTP: ${storedData.otp}, Expires at: ${new Date(storedData.expiresAt).toISOString()}`
    );

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(normalizedPhoneNumber);
      try {
        await Otp.findOneAndDelete({ mobileNumber: normalizedPhoneNumber });
      } catch (dbError) {
        console.error(`⚠️ Error deleting expired OTP from database:`, dbError.message);
      }
      return {
        status: 400,
        json: {
          success: false,
          error: "OTP has expired. Please request a new OTP.",
        },
      };
    }

    if (storedData.userId !== userId) {
      return {
        status: 400,
        json: { success: false, error: "Invalid user ID" },
      };
    }

    if (storedData.otp !== otp) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Invalid OTP. Please try again.",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, error: "User not found" } };
    }

    user.notificationPhoneNumber = normalizedPhoneNumber;
    user.notificationPhoneVerified = true;
    await user.save();

    otpStore.delete(normalizedPhoneNumber);
    try {
      await Otp.findOneAndDelete({ mobileNumber: normalizedPhoneNumber });
    } catch (dbError) {
      console.error(`⚠️ Error deleting OTP from database:`, dbError.message);
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Phone number verified successfully",
        user: {
          notificationPhoneNumber: user.notificationPhoneNumber,
          notificationPhoneVerified: user.notificationPhoneVerified,
        },
      },
    };
  } catch (error) {
    console.error("Error in /api/sms/verify-otp:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to verify OTP. Please try again later.",
        message: "Internal server error",
      },
    };
  }
}

module.exports = {
  send,
  sendBulk,
  verifyConfig,
  sendTest,
  sendOtp,
  verifyOtp,
};
