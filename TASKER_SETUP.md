# Tasker SMS Forwarding Setup Guide

This guide will help you configure Tasker to automatically forward SMS messages from AirtelTigo to your backend server.

## Prerequisites

1. **Tasker App** - Install from Google Play Store (paid app, ~$3.50)
2. **Android Phone** - Must be running Android
3. **Backend Server** - Must be accessible from your phone (same network or public URL)

## Step 1: Install Tasker

1. Download Tasker from Google Play Store
2. Open Tasker and grant necessary permissions

## Step 2: Create a Profile

1. Open Tasker
2. Tap the **"+"** button at the bottom
3. Select **"Event"**
4. **Tap "Phone"** from the event categories list
5. **Tap "Received Text"** (SMS)
6. Configure the SMS event:
   - **Type**: SMS (should be default)
   - **Sender**: Leave empty (to catch all SMS) OR enter "MTN" to filter only MTN messages
   - **Content**: 
     - For MTN: Enter `Payment received` (this will only trigger on payment SMS)
     - OR leave empty to catch all messages (you'll see more logs but it works)
   - Tap the back arrow (←) to save

## Step 3: Create a Task

1. After creating the profile, Tasker will ask you to create a task
2. Name it: **"Forward SMS to Backend"**
3. Tap the **"+"** button in the task
4. Select **"HTTP Request"**
5. Configure:
   - **Method**: POST
   - **URL**: 
     - **Vercel (Production)**: `https://sporty-bet-serverr.vercel.app/api/1win/payments/sms-webhook` ✅ **USE THIS**
     - **Local (Development)**: `http://YOUR_COMPUTER_IP:5008/api/1win/payments/sms-webhook`
     - **Example Local**: `http://192.168.1.100:5008/api/1win/payments/sms-webhook`
   - **Headers**: 
     - Add: `Content-Type` = `application/json`
   - **Body**: 
     ```
     {
       "message": "%SMSRB",
       "sender": "%SMSRN",
       "phoneNumber": "%SMSRN"
     }
     ```
   - **%SMSRB** = SMS message body
   - **%SMSRN** = SMS sender phone number

## Step 4: Test the Setup

1. Send a test SMS to your phone
2. Check your backend logs to see if the webhook is being called
3. Check Tasker's run log to see if the task executed

## Step 5: Find Your Computer's IP Address

### Windows:
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter

### Or use:
- Open Command Prompt
- Type: `ipconfig`
- Find your local IP (usually starts with 192.168.x.x or 10.0.x.x)

## Important Notes

1. **Phone and Computer must be on the same network** (same WiFi) for local testing
2. **Backend must be running** on port 5002
3. **Firewall**: Make sure Windows Firewall allows connections on port 5002
4. **Tasker Variables**:
   - `%SMSRB` = Message body
   - `%SMSRN` = Sender number
   - `%SMSRF` = Sender name (if available)

## Troubleshooting

- **Webhook not receiving data**: Check if phone and computer are on same network
- **Task not running**: Check Tasker permissions for SMS access
- **Connection refused**: Check if backend is running and firewall settings

## Alternative: Use ngrok for Public URL (if not on same network)

1. Install ngrok: https://ngrok.com/
2. Run: `ngrok http 5002`
3. Use the ngrok URL in Tasker: `https://xxxx.ngrok.io/api/1win/payments/sms-webhook`

