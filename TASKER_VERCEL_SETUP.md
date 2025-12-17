# Tasker Setup for Vercel Deployment

## ✅ Your Vercel Webhook URL

**Use this URL in Tasker:**

```
https://sporty-bet-serverr.vercel.app/api/1win/payments/sms-webhook
```

## Quick Setup Steps

1. **Open Tasker** on your Android phone
2. **Find your SMS forwarding task** (or create a new one)
3. **Update the HTTP Request URL** to:
   ```
   https://sporty-bet-serverr.vercel.app/api/1win/payments/sms-webhook
   ```
4. **Keep the same configuration:**
   - **Method**: POST
   - **Headers**: `Content-Type` = `application/json`
   - **Body**:
     ```json
     {
       "message": "%SMSRB",
       "sender": "%SMSRN",
       "phoneNumber": "%SMSRN"
     }
     ```

## How It Works

1. **User makes payment** → Sends money via Mobile Money (AirtelTigo/MTN)
2. **SMS received** → Your phone receives payment confirmation SMS
3. **Tasker detects SMS** → Automatically triggers when payment SMS arrives
4. **Tasker sends to Vercel** → POSTs SMS content to your Vercel webhook
5. **Backend processes** → Matches payment by amount and activates subscription
6. **User gets access** → Subscription activated automatically!

## Testing

1. Make a test payment
2. Check Vercel logs: Dashboard → Your Project → Functions → `api/index.js` → Logs
3. Look for: "SMS received:" and "Payment processed successfully"

## Important Notes

- ✅ **Works from anywhere** - No need for same WiFi network (unlike local setup)
- ✅ **Always online** - Vercel keeps your backend running 24/7
- ✅ **Secure** - HTTPS encrypted connection
- ⚠️ **Make sure** `MOBILE_MONEY_PHONE` environment variable is set in Vercel

## Troubleshooting

- **Tasker not sending**: Check Tasker has internet permission
- **Webhook not receiving**: Check Vercel logs for errors
- **Payment not matching**: Verify `MOBILE_MONEY_PHONE` matches the phone receiving SMS






