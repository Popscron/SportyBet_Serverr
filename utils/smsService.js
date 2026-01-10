const twilio = require('twilio');

// Initialize Twilio client
// These will be read from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

// Initialize Twilio client if credentials are available
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
} else {
  console.warn('⚠️ Twilio credentials not found. SMS functionality will be disabled.');
  console.warn('Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment variables.');
}

/**
 * Send SMS using Twilio
 * @param {string} to - Recipient phone number (E.164 format: +1234567890)
 * @param {string} message - Message body
 * @returns {Promise<Object>} - Twilio message object
 */
const sendSMS = async (to, message) => {
  try {
    // Validate SMS service client is initialized
    if (!twilioClient) {
      throw new Error('SMS service not available. Please contact support.');
    }

    // Validate phone number format (should be E.164 format)
    if (!to || !to.startsWith('+')) {
      throw new Error('Invalid phone number format. Phone number must be in E.164 format (e.g., +1234567890)');
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    // Send SMS
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to
    });

    // Check if SMS was actually sent successfully
    // SMS service status can be: queued, sending, sent, failed, delivered, undelivered
    const isSuccess = result.status !== 'failed' && result.status !== 'undelivered';
    
    if (isSuccess) {
      console.log(`✅ SMS sent successfully to ${to}. SID: ${result.sid}, Status: ${result.status}`);
    } else {
      console.error(`❌ SMS failed to send to ${to}. Status: ${result.status}, SID: ${result.sid}`);
    }
    
    return {
      success: isSuccess,
      messageSid: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
      body: result.body,
      dateCreated: result.dateCreated,
      error: isSuccess ? null : 'SMS delivery failed. Please try again later.'
    };
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    
    // Return generic error message to users (hide Twilio-specific errors)
    let userFriendlyError = 'Failed to send SMS. Please try again later.';
    
    // Map common Twilio error codes to user-friendly messages
    if (error.code) {
      switch (error.code) {
        case 21211:
          userFriendlyError = 'Invalid phone number format.';
          break;
        case 21608:
          userFriendlyError = 'Phone number is not verified.';
          break;
        case 21614:
          userFriendlyError = 'Invalid phone number.';
          break;
        default:
          userFriendlyError = 'Failed to send SMS. Please try again later.';
      }
    }
    
    return {
      success: false,
      error: userFriendlyError,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * Send SMS to multiple recipients
 * @param {Array<string>} recipients - Array of phone numbers (E.164 format)
 * @param {string} message - Message body
 * @returns {Promise<Array>} - Array of results for each recipient
 */
const sendBulkSMS = async (recipients, message) => {
  try {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients must be a non-empty array');
    }

    const results = await Promise.allSettled(
      recipients.map(recipient => sendSMS(recipient, message))
    );

    return results.map((result, index) => ({
      recipient: recipients[index],
      ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason.message })
    }));
  } catch (error) {
    console.error('❌ Error sending bulk SMS:', error.message);
    throw error;
  }
};

/**
 * Verify Twilio configuration
 * @returns {Object} - Configuration status
 */
const verifyTwilioConfig = () => {
  const config = {
    accountSid: !!accountSid,
    authToken: !!authToken,
    phoneNumber: !!twilioPhoneNumber,
    clientInitialized: !!twilioClient
  };

  const allConfigured = config.accountSid && config.authToken && config.phoneNumber && config.clientInitialized;

  return {
    configured: allConfigured,
    details: config,
    message: allConfigured 
      ? 'SMS service is properly configured' 
      : 'SMS service is not fully configured. Please check your environment variables.'
  };
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  verifyTwilioConfig
};

