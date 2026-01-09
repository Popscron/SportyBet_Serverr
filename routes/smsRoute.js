const express = require('express');
const router = express.Router();
const { sendSMS, sendBulkSMS, verifyTwilioConfig } = require('../utils/smsService');

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

module.exports = router;

