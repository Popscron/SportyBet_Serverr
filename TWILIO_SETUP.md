# Twilio SMS Setup Guide

This guide will help you set up Twilio SMS functionality for the SportyBet app.

## Step 1: Create a Twilio Account

1. Go to [https://www.twilio.com](https://www.twilio.com)
2. Sign up for a free account (includes $15.50 free credit for testing)
3. Verify your email and phone number

## Step 2: Get Your Twilio Credentials

1. Log in to your Twilio Console: [https://console.twilio.com](https://console.twilio.com)
2. Go to **Account** → **API Keys & Tokens**
3. You'll need:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)

## Step 3: Get a Twilio Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select your country/region
3. Choose a phone number (free trial accounts get a number for free)
4. Note down your phone number (format: `+1234567890`)

## Step 4: Set Environment Variables

Add these environment variables to your backend:

### For Local Development (.env file):
```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### For Vercel Deployment:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these variables:
   - `TWILIO_ACCOUNT_SID` = Your Account SID
   - `TWILIO_AUTH_TOKEN` = Your Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (E.164 format)

## Step 5: Test the SMS Service

### Test via API:

**1. Verify Configuration:**
```bash
GET https://your-backend-url/api/sms/verify-config
```

**2. Send Test SMS:**
```bash
POST https://your-backend-url/api/sms/test
Content-Type: application/json

{
  "to": "+1234567890"
}
```

**3. Send Custom SMS:**
```bash
POST https://your-backend-url/api/sms/send
Content-Type: application/json

{
  "to": "+1234567890",
  "message": "Hello from SportyBet!"
}
```

## API Endpoints

### 1. Verify Configuration
- **GET** `/api/sms/verify-config`
- Returns Twilio configuration status

### 2. Send SMS
- **POST** `/api/sms/send`
- Body: `{ "to": "+1234567890", "message": "Your message" }`

### 3. Send Bulk SMS
- **POST** `/api/sms/send-bulk`
- Body: `{ "recipients": ["+1234567890", "+0987654321"], "message": "Your message" }`

### 4. Test SMS
- **POST** `/api/sms/test`
- Body: `{ "to": "+1234567890" }`
- Sends a test message

## Phone Number Format

**Important:** All phone numbers must be in **E.164 format**:
- ✅ Correct: `+1234567890`, `+233123456789`
- ❌ Wrong: `1234567890`, `(123) 456-7890`, `123-456-7890`

## Free Trial Limitations

- Twilio free trial accounts can only send SMS to **verified phone numbers**
- To verify a phone number:
  1. Go to Twilio Console → **Phone Numbers** → **Verified Caller IDs**
  2. Add your phone number
  3. Verify via SMS or call

## Production Considerations

1. **Upgrade Account:** Free trial has limitations. Upgrade for production use
2. **Rate Limits:** Be aware of Twilio rate limits
3. **Cost:** Check Twilio pricing: [https://www.twilio.com/pricing](https://www.twilio.com/pricing)
4. **Security:** Never expose your Auth Token in frontend code
5. **Error Handling:** Implement proper error handling for failed SMS sends

## Troubleshooting

### Error: "Twilio client not initialized"
- Check that all environment variables are set correctly
- Restart your server after adding environment variables

### Error: "Invalid phone number format"
- Ensure phone numbers are in E.164 format (start with `+`)
- Include country code (e.g., `+1` for US, `+233` for Ghana)

### Error: "Unable to create record"
- Check your Twilio account balance
- Verify your phone number is correct
- Check if you're on free trial and sending to unverified numbers

## Example Usage in Code

```javascript
// In your backend route/controller
const { sendSMS } = require('../utils/smsService');

// Send SMS
const result = await sendSMS('+1234567890', 'Hello from SportyBet!');

if (result.success) {
  console.log('SMS sent:', result.messageSid);
} else {
  console.error('Failed to send SMS:', result.error);
}
```

## Support

- Twilio Documentation: [https://www.twilio.com/docs](https://www.twilio.com/docs)
- Twilio Support: [https://support.twilio.com](https://support.twilio.com)

