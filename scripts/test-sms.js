/**
 * Test Script for Twilio SMS Integration
 * 
 * Usage:
 * node scripts/test-sms.js
 * 
 * Or with specific phone number:
 * node scripts/test-sms.js +1234567890
 */

require('dotenv').config();
const { sendSMS, verifyTwilioConfig } = require('../utils/smsService');

async function testSMS() {
  console.log('🧪 Testing Twilio SMS Integration...\n');

  // Step 1: Verify Configuration
  console.log('1️⃣ Checking Twilio Configuration...');
  const configStatus = verifyTwilioConfig();
  console.log('Configuration Status:', configStatus);
  
  if (!configStatus.configured) {
    console.error('\n❌ Twilio is not properly configured!');
    console.error('Please set the following environment variables:');
    console.error('  - TWILIO_ACCOUNT_SID');
    console.error('  - TWILIO_AUTH_TOKEN');
    console.error('  - TWILIO_PHONE_NUMBER');
    console.error('\nSee TWILIO_SETUP.md for setup instructions.');
    process.exit(1);
  }
  
  console.log('✅ Twilio is properly configured!\n');

  // Step 2: Get phone number from command line or prompt
  const phoneNumber = process.argv[2];
  
  if (!phoneNumber) {
    console.error('❌ Please provide a phone number in E.164 format');
    console.error('Usage: node scripts/test-sms.js +1234567890');
    console.error('\nExample:');
    console.error('  node scripts/test-sms.js +233123456789');
    console.error('  node scripts/test-sms.js +1234567890');
    process.exit(1);
  }

  // Validate phone number format
  if (!phoneNumber.startsWith('+')) {
    console.error('❌ Phone number must be in E.164 format (start with +)');
    console.error('Example: +1234567890 or +233123456789');
    process.exit(1);
  }

  // Step 3: Send test SMS
  console.log(`2️⃣ Sending test SMS to ${phoneNumber}...`);
  const testMessage = `🧪 Test SMS from SportyBet App
Time: ${new Date().toLocaleString()}
This is a test message to verify Twilio SMS integration is working correctly.`;

  try {
    const result = await sendSMS(phoneNumber, testMessage);
    
    if (result.success) {
      console.log('\n✅ SMS sent successfully!');
      console.log('Message SID:', result.messageSid);
      console.log('Status:', result.status);
      console.log('To:', result.to);
      console.log('From:', result.from);
      console.log('\n📱 Check your phone for the test message!');
    } else {
      console.error('\n❌ Failed to send SMS');
      console.error('Error:', result.error);
      console.error('Code:', result.code);
      
      if (result.code === 21211) {
        console.error('\n💡 Tip: This error usually means the phone number is invalid.');
        console.error('Make sure the number is in E.164 format: +[country code][number]');
      } else if (result.code === 21608) {
        console.error('\n💡 Tip: On Twilio free trial, you can only send SMS to verified numbers.');
        console.error('Verify your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testSMS();

