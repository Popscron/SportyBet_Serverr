# Environment Variables for Vercel Deployment

Copy and paste these into Vercel Dashboard → Settings → Environment Variables

## 🔴 REQUIRED (Must Add)

### 1. MongoDB Connection
```
MONGO_URL=mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority
```

### 2. JWT Secret (Choose ONE - both work)
```
JWT_SECRET=your-super-secret-jwt-key-change-in-production-123456789
```
OR
```
JWT_SECRET_1WIN=your-super-secret-jwt-key-change-in-production-123456789
```

**⚠️ IMPORTANT:** Change `your-super-secret-jwt-key-change-in-production-123456789` to a strong random string (at least 32 characters)

---

## 🟡 RECOMMENDED (Should Add)

### 3. JWT Expiration
```
JWT_EXPIRE=7d
```
(Options: `7d`, `30d`, `1h`, `24h`)

### 4. Mobile Money Phone Number
```
MOBILE_MONEY_PHONE=0535899507
```
(Your AirtelTigo mobile money number for receiving payments)

### 5. Frontend URL (for email links)
```
FRONTEND_URL=https://admingh.online
```
(Your frontend website URL)

---

## 🟢 OPTIONAL (Add if needed)

### 6. Email Service (SMTP) - For payment confirmation emails

If you want to send payment confirmation emails:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

**Note:** For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an "App Password" at https://myaccount.google.com/apppasswords
3. Use that App Password (not your regular Gmail password)

### 7. Cloudinary (for image uploads)

If you want to use Cloudinary for image storage:

```
CLOUDINARY_CLOUD_NAME=dir5lv73s
CLOUDINARY_API_KEY=522134132512322
CLOUDINARY_API_SECRET=CKkwDdGy6upFsnt9HgFhIIHxuMo
```

**Note:** These are the current values in your code. Consider changing them for security.

### 8. Node Environment
```
NODE_ENV=production
```

---

## 📋 Quick Copy-Paste List

Copy all of these into Vercel:

```
MONGO_URL=mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-in-production-123456789
JWT_EXPIRE=7d
MOBILE_MONEY_PHONE=0535899507
FRONTEND_URL=https://admingh.online
NODE_ENV=production
```

---

## 🔐 How to Generate a Strong JWT Secret

You can generate a secure random string using:

**Option 1: Online**
- Visit: https://randomkeygen.com/
- Use "CodeIgniter Encryption Keys" (256-bit)

**Option 2: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: OpenSSL**
```bash
openssl rand -hex 32
```

---

## ✅ After Adding Variables

1. **Redeploy** your project in Vercel (or it will auto-deploy)
2. **Test** your API endpoints
3. **Check logs** if anything fails

---

## 🧪 Test Your Deployment

After deployment, test these endpoints:

1. **Health Check:**
   ```
   GET https://your-project.vercel.app/health
   ```

2. **API Info:**
   ```
   GET https://your-project.vercel.app/
   ```

3. **Test Registration:**
   ```
   POST https://your-project.vercel.app/api/1win/auth/register
   Content-Type: application/json
   
   {
     "email": "test@example.com",
     "password": "test1234",
     "name": "Test User"
   }
   ```

