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
    // Validate Twilio client is initialized
    if (!twilioClient) {
      throw new Error('Twilio client not initialized. Please check your environment variables.');
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
    // Twilio status can be: queued, sending, sent, failed, delivered, undelivered
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
      error: isSuccess ? null : `SMS status: ${result.status}`
    };
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    
    return {
      success: false,
      error: error.message,
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
      ? 'Twilio is properly configured' 
      : 'Twilio is not fully configured. Please check your environment variables.'
  };
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  verifyTwilioConfig
};

