# Payment System Setup Guide

## Overview
Automated Mobile Money (AirtelTigo) payment system that detects transactions via SMS and automatically activates user subscriptions.

## System Architecture

### Flow:
1. User clicks "Pay" on subscription plan
2. Backend generates unique payment request with reference code
3. User receives payment instructions (amount, phone number)
4. User sends money via AirtelTigo Mobile Money
5. Phone receives SMS notification
6. Tasker forwards SMS to backend webhook
7. Backend parses SMS and matches payment by amount + phone number
8. Subscription automatically activated
9. User redirected to Mines Predictor page

## Configuration

### 1. Environment Variables (.env)

Add these to `SportyBet_Serverr/.env`:

```env
# Mobile Money Phone Number (MTN or AirtelTigo)
MOBILE_MONEY_PHONE=+233539769182

# Cloudinary (for image uploads if needed)
CLOUDINARY_CLOUD_NAME=dcwc3ehp3
CLOUDINARY_API_KEY=283419252513685
CLOUDINARY_API_SECRET=gGz5YtguIm-W42mabvpOsSSF_7c

# MongoDB (if using different database)
MONGO_URL=mongodb+srv://capsiteafrica:zZCMFdSW946pCFuX@sportybetdb.eqnbipl.mongodb.net/?retryWrites=true&w=majority&appName=SportyBetDB
```

### 2. Tasker Setup

See `TASKER_SETUP.md` for detailed Tasker configuration.

**Quick Setup:**
1. Install Tasker from Google Play
2. Create Profile: Event → Received Text (SMS)
3. Create Task: HTTP Request
   - Method: POST
   - URL: `http://YOUR_COMPUTER_IP:5002/api/1win/payments/sms-webhook`
   - Body (JSON):
     ```json
     {
       "message": "%SMSRB",
       "sender": "%SMSRN",
       "phoneNumber": "%SMSRN"
     }
     ```

### 3. Find Your Computer IP

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" (usually 192.168.x.x)

**Important:** Phone and computer must be on the same WiFi network for local testing.

## SMS Format

The system supports both **MTN** and **AirtelTigo** mobile money SMS formats:

### MTN Format:

**Received Money:**
```
Payment received for GHS 100.00 from ENOCK WORNAME Current Balance: GHS 1067.59 . Available Balance: GHS 1067.59. Reference: Q. Transaction ID: 70514217857. TRANSACTION FEE: 0.00
```

**Sent Money (ignored):**
```
Payment sent for GHS 100.00 to...
```

### AirtelTigo Format:

**Received Money:**
```
Dear Customer, you have received GHS 29.99 from 0244123456. Trans ID: GM251127.0930.C09997...
```

**Sent Money (ignored):**
```
Dear Customer, you have sent GHS 550.00 to PHILIP FIIFI HANSON, mobile money wallet +233539769182...
```

## Payment Matching Logic

Since AirtelTigo Transaction IDs don't match our reference codes, payments are matched by:
1. **Amount** (must match exactly)
2. **Recipient Phone Number** (must match `MOBILE_MONEY_PHONE`)
3. **Status** (must be pending)
4. **Expiration** (must not be expired)

**Note:** If multiple users send the same amount simultaneously, the most recent pending payment will be matched.

## API Endpoints

### Create Payment Request
```
POST /api/1win/payments/create
Headers: Authorization: Bearer <token>
Body: {
  "planType": "gold|diamond|platinum",
  "amount": 29.99
}
```

### SMS Webhook (Tasker)
```
POST /api/1win/payments/sms-webhook
Body: {
  "message": "SMS text content",
  "sender": "0244123456",
  "phoneNumber": "0244123456"
}
```

### Check Payment Status
```
GET /api/1win/payments/status/:reference
Headers: Authorization: Bearer <token>
```

### Get Payment History
```
GET /api/1win/payments/my-payments
Headers: Authorization: Bearer <token>
```

## Subscription Durations

- **Gold**: 30 days
- **Diamond**: 90 days
- **Platinum**: 180 days

## Testing

1. **Start Backend:**
   ```bash
   cd SportyBet_Serverr
   npm start
   ```

2. **Start Frontend:**
   ```bash
   cd 1win_web
   npm run dev
   ```

3. **Test Payment Flow:**
   - Login to `http://localhost:5174`
   - Go to Dashboard
   - Click "Pay" on any plan
   - Send exact amount to `MOBILE_MONEY_PHONE`
   - System should detect and activate subscription

## Troubleshooting

### Payment Not Detected
- Check Tasker is running and has SMS permissions
- Verify phone and computer are on same network
- Check backend logs for SMS webhook calls
- Verify `MOBILE_MONEY_PHONE` matches recipient in SMS

### CORS Errors
- Backend already configured to allow requests with no origin (Tasker)
- Check firewall allows connections on port 5002

### Amount Mismatch
- User must send exact amount (e.g., 29.99, not 30.00)
- Check SMS parser extracted correct amount

## Production Deployment

1. **Update API_URL** in `1win_web/src/config/config.js`:
   ```javascript
   export const API_URL = "https://your-domain.com/api/1win";
   ```

2. **Use ngrok or deploy backend** with public URL

3. **Update Tasker webhook URL** to production endpoint

4. **Add API key authentication** to SMS webhook for security

## Security Notes

⚠️ **Current Implementation:**
- SMS webhook is public (no authentication)
- Suitable for local testing only

✅ **Production Recommendations:**
- Add API key authentication to SMS webhook
- Use HTTPS for all endpoints
- Validate SMS sender (only accept from AirtelTigo numbers)
- Rate limit webhook endpoint

