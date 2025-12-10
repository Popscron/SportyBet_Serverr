# Gmail SMTP Setup Guide

## Step 1: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Under "Signing in to Google", enable **2-Step Verification** if not already enabled

## Step 2: Generate App Password

1. Still in Security settings, scroll down to "Signing in to Google"
2. Click on **App passwords** (you may need to search for it)
3. Select **Mail** as the app
4. Select **Other (Custom name)** as the device
5. Enter a name like "1Win Server"
6. Click **Generate**
7. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

## Step 3: Add SMTP Credentials to .env File

Add these lines to your `.env` file in the `SportyBet_Serverr` directory:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

**Important:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `your-16-character-app-password` with the App Password you generated (remove spaces)
- The App Password is NOT your regular Gmail password

## Step 4: Test the Setup

After adding the credentials, restart your server. When a payment is confirmed, an email will be automatically sent to the user's registered email address.

## Troubleshooting

If emails are not sending:
1. Make sure 2FA is enabled on your Gmail account
2. Verify the App Password is correct (no spaces)
3. Check server logs for email errors
4. Make sure Gmail account has "Less secure app access" is NOT needed (App Passwords replace this)
