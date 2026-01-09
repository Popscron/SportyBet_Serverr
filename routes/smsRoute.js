const express = require('express');
const router = express.Router();
const { sendSMS, sendBulkSMS, verifyTwilioConfig } = require('../utils/smsService');
const User = require('../models/user');

// In-memory OTP storage (phoneNumber -> { otp, expiresAt, userId })
// In production, consider using Redis for better scalability
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Clean expired OTPs (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(phone);
    }
  }
}, 5 * 60 * 1000);

/**
 * @route   POST /api/sms/send
 * @desc    Send SMS to a single recipient
 * @access  Public (can be protected with auth middleware if needed)
 * 
 * Body:
 * {
 *   "to": "+1234567890",  // Phone number in E.164 format
 *   "message": "Your message here"
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    // Validate required fields
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Phone number (to) is required'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Send SMS
    const result = await sendSMS(to, message);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result,
        message: 'SMS sent successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error in /api/sms/send:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/sms/send-bulk
 * @desc    Send SMS to multiple recipients
 * @access  Public (can be protected with auth middleware if needed)
 * 
 * Body:
 * {
 *   "recipients": ["+1234567890", "+0987654321"],
 *   "message": "Your message here"
 * }
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, message } = req.body;

    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients must be a non-empty array'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Send bulk SMS
    const results = await sendBulkSMS(recipients, message);

    return res.status(200).json({
      success: true,
      data: results,
      message: `SMS sent to ${results.length} recipient(s)`
    });
  } catch (error) {
    console.error('Error in /api/sms/send-bulk:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/sms/verify-config
 * @desc    Verify Twilio configuration
 * @access  Public
 */
router.get('/verify-config', (req, res) => {
  try {
    const configStatus = verifyTwilioConfig();
    
    return res.status(200).json({
      success: true,
      data: configStatus
    });
  } catch (error) {
    console.error('Error in /api/sms/verify-config:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/sms/test
 * @desc    Test SMS functionality (sends a test message)
 * @access  Public
 * 
 * Body:
 * {
 *   "to": "+1234567890"  // Optional, defaults to a test number if not provided
 * }
 */
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body;
    
    // Test message
    const testMessage = `🧪 Test SMS from SportyBet App
Time: ${new Date().toLocaleString()}
This is a test message to verify Twilio SMS integration is working correctly.`;

    // Use provided number or require it
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Phone number (to) is required for test'
      });
    }

    // Send test SMS
    const result = await sendSMS(to, testMessage);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Test SMS sent successfully! Check your phone.'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: result.code,
        message: 'Failed to send test SMS'
      });
    }
  } catch (error) {
    console.error('Error in /api/sms/test:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/sms/send-otp
 * @desc    Send OTP to notification phone number for verification
 * @access  Public
 * 
 * Body:
 * {
 *   "userId": "user_id_here",
 *   "phoneNumber": "+1234567890"  // Phone number in E.164 format
 * }
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { userId, phoneNumber } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Normalize phone number (trim whitespace)
    const normalizedPhoneNumber = phoneNumber.trim();
    console.log(`📱 Send OTP - Original: "${phoneNumber}", Normalized: "${normalizedPhoneNumber}"`);

    // Validate phone number format (should be E.164 format)
    if (!normalizedPhoneNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Phone number must be in E.164 format (e.g., +1234567890)'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Store OTP with normalized phone number as key
    otpStore.set(normalizedPhoneNumber, { otp, expiresAt, userId });
    console.log(`✅ OTP stored for: "${normalizedPhoneNumber}", OTP: ${otp}, Expires at: ${new Date(expiresAt).toISOString()}`);
    console.log(`📊 Current OTP store size: ${otpStore.size}, Keys:`, Array.from(otpStore.keys()));

    // Send OTP via SMS
    const message = `Your SportyBet verification code is: ${otp}\n\nThis code will expire in 10 minutes.`;
    const result = await sendSMS(normalizedPhoneNumber, message);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        expiresIn: 10 * 60 // seconds
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: result.code,
        message: 'Failed to send OTP'
      });
    }
  } catch (error) {
    console.error('Error in /api/sms/send-otp:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/sms/verify-otp
 * @desc    Verify OTP and mark phone number as verified
 * @access  Public
 * 
 * Body:
 * {
 *   "userId": "user_id_here",
 *   "phoneNumber": "+1234567890",
 *   "otp": "123456"
 * }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, phoneNumber, otp } = req.body;

    if (!userId || !phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        error: 'User ID, phone number, and OTP are required'
      });
    }

    // Normalize phone number (trim whitespace) to match the key used when storing
    const normalizedPhoneNumber = phoneNumber.trim();
    console.log(`🔍 Verify OTP - Original: "${phoneNumber}", Normalized: "${normalizedPhoneNumber}", OTP: ${otp}`);
    console.log(`📊 Current OTP store size: ${otpStore.size}, Keys:`, Array.from(otpStore.keys()));

    // Get stored OTP data using normalized phone number
    const storedData = otpStore.get(normalizedPhoneNumber);

    if (!storedData) {
      console.error(`❌ OTP not found for: "${normalizedPhoneNumber}"`);
      console.error(`🔍 Available keys in store:`, Array.from(otpStore.keys()));
      return res.status(400).json({
        success: false,
        error: 'OTP not found or expired. Please request a new OTP.'
      });
    }
    
    console.log(`✅ OTP found for: "${normalizedPhoneNumber}", Stored OTP: ${storedData.otp}, Expires at: ${new Date(storedData.expiresAt).toISOString()}`);

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(normalizedPhoneNumber);
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check if userId matches
    if (storedData.userId !== userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid - update user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user's notification phone number and mark as verified
    user.notificationPhoneNumber = normalizedPhoneNumber;
    user.notificationPhoneVerified = true;
    await user.save();

    // Remove OTP from store
    otpStore.delete(normalizedPhoneNumber);

    return res.status(200).json({
      success: true,
      message: 'Phone number verified successfully',
      user: {
        notificationPhoneNumber: user.notificationPhoneNumber,
        notificationPhoneVerified: user.notificationPhoneVerified
      }
    });
  } catch (error) {
    console.error('Error in /api/sms/verify-otp:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;

