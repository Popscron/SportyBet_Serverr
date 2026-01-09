/**
 * Quick Test Script for Twilio SMS
 * This script uses the provided credentials directly for testing
 */

const twilio = require('twilio');

// Your Twilio credentials
// ⚠️ SECURITY: Replace these with your actual credentials from environment variables
// For testing, you can temporarily hardcode them here, but NEVER commit them to git!
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_account_sid_here';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_auth_token_here';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

// Initialize Twilio client
const client = twilio(accountSid, authToken);

async function testSMS() {
  console.log('🧪 Testing Twilio SMS Integration...\n');
  console.log('Account SID:', accountSid);
  console.log('Phone Number:', twilioPhoneNumber);
  console.log('');

  // Get phone number from command line
  const recipientPhone = process.argv[2];
  
  if (!recipientPhone) {
    console.error('❌ Please provide a recipient phone number');
    console.error('Usage: node scripts/test-sms-quick.js +1234567890');
    console.error('\nExample:');
    console.error('  node scripts/test-sms-quick.js +233123456789');
    console.error('  node scripts/test-sms-quick.js +1234567890');
    console.error('\n⚠️ Note: On Twilio free trial, you can only send to verified numbers.');
    console.error('Verify your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    process.exit(1);
  }

  // Validate phone number format
  if (!recipientPhone.startsWith('+')) {
    console.error('❌ Phone number must be in E.164 format (start with +)');
    console.error('Example: +1234567890 or +233123456789');
    process.exit(1);
  }

  // Test message
  const testMessage = `🧪 Test SMS from SportyBet App
Time: ${new Date().toLocaleString()}
This is a test message to verify Twilio SMS integration is working correctly.`;

  try {
    console.log(`📤 Sending test SMS to ${recipientPhone}...`);
    console.log('From:', twilioPhoneNumber);
    console.log('Message:', testMessage.substring(0, 50) + '...');
    console.log('');

    // Send SMS
    const message = await client.messages.create({
      body: testMessage,
      from: twilioPhoneNumber,
      to: recipientPhone
    });

    console.log('✅ SMS sent successfully!');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
    console.log('To:', message.to);
    console.log('From:', message.from);
    console.log('\n📱 Check your phone for the test message!');
    
  } catch (error) {
    console.error('\n❌ Error sending SMS:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    
    if (error.code === 21211) {
      console.error('\n💡 Tip: Invalid phone number format.');
      console.error('Make sure the number is in E.164 format: +[country code][number]');
    } else if (error.code === 21608) {
      console.error('\n💡 Tip: On Twilio free trial, you can only send SMS to verified numbers.');
      console.error('Verify your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    } else if (error.code === 20003) {
      console.error('\n💡 Tip: Authentication failed. Check your Account SID and Auth Token.');
    } else if (error.code === 21210) {
      console.error('\n💡 Tip: Invalid "from" phone number. Check your Twilio phone number.');
    }
    
    process.exit(1);
  }
}

// Run the test
testSMS();

