# Vercel Deployment Guide for SportyBet Backend

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. MongoDB Atlas account (or your MongoDB connection string)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Environment Variables

Before deploying, you need to set up environment variables in Vercel:

### Required Environment Variables:

1. **MONGO_URL** (Required)
   - Your MongoDB connection string
   - Example: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

2. **JWT_SECRET** or **JWT_SECRET_1WIN** (Required)
   - Secret key for JWT token generation
   - Use a strong random string (at least 32 characters)
   - Example: `your-super-secret-jwt-key-change-in-production`

3. **JWT_EXPIRE** (Optional)
   - JWT token expiration time
   - Default: `7d`
   - Example: `7d`, `30d`, `1h`

4. **MOBILE_MONEY_PHONE** (Optional - for payment system)
   - Phone number for receiving mobile money payments
   - Example: `+233539769182`

5. **SMTP Configuration** (Optional - for email service)
   - `SMTP_HOST` - SMTP server hostname
   - `SMTP_PORT` - SMTP server port (usually 587)
   - `SMTP_USER` - SMTP username/email
   - `SMTP_PASS` - SMTP password
   - `SMTP_FROM` - Email address to send from

6. **Cloudinary Configuration** (Optional - for image uploads)
   - `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY` - Your Cloudinary API key
   - `CLOUDINARY_API_SECRET` - Your Cloudinary API secret

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Navigate to your project directory:
```bash
cd SportyBet_Serverr
```

4. Deploy:
```bash
vercel
```

5. For production deployment:
```bash
vercel --prod
```

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `SportyBet_Serverr` (if your repo has multiple projects)
   - **Build Command**: Leave empty or use `npm run vercel-build`
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`

5. Add Environment Variables:
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above

6. Click "Deploy"

## Step 3: Update Frontend API URL

After deployment, update your frontend configuration:

1. Get your Vercel deployment URL (e.g., `https://your-project.vercel.app`)

2. Update `1win_web/src/config/config.js`:
```javascript
// PRODUCTION
export const API_URL = "https://your-project.vercel.app/api/1win";
```

## Step 4: CORS Configuration

If you need to add more allowed origins, update the CORS configuration in `api/index.js`:

```javascript
const allowedOrigins = [
  "https://admingh.online",
  "https://www.admingh.online",
  "https://your-frontend-domain.com", // Add your frontend domain
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];
```

## Important Notes

1. **File Uploads**: The `/uploads` directory is not persistent on Vercel. Use Cloudinary or another cloud storage service for file uploads.

2. **Serverless Functions**: Vercel runs your app as serverless functions. Each function has a maximum execution time of 10 seconds (can be extended to 60 seconds for Pro plans).

3. **Database Connections**: MongoDB connections are pooled and reused across function invocations. The connection check in `api/index.js` prevents multiple connection attempts.

4. **Environment Variables**: Make sure all environment variables are set in Vercel dashboard before deploying.

5. **Build Time**: The build process installs dependencies. Make sure `package.json` includes all required dependencies.

## Testing the Deployment

After deployment, test your API:

1. Health check:
```
GET https://your-project.vercel.app/health
```

2. API info:
```
GET https://your-project.vercel.app/
```

3. Test registration:
```
POST https://your-project.vercel.app/api/1win/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "test1234",
  "name": "Test User"
}
```

## Troubleshooting

### Issue: "Function timeout"
- **Solution**: Increase function timeout in `vercel.json` (max 60s for Pro)

### Issue: "MongoDB connection failed"
- **Solution**: Check `MONGO_URL` environment variable is set correctly in Vercel dashboard

### Issue: "CORS errors"
- **Solution**: Add your frontend domain to the `allowedOrigins` array in `api/index.js`

### Issue: "Module not found"
- **Solution**: Ensure all dependencies are listed in `package.json` and not in `devDependencies`

## Monitoring

- Check Vercel dashboard for deployment logs
- Monitor function execution times and errors
- Set up Vercel Analytics for API usage insights

## Support

For more information:
- Vercel Docs: https://vercel.com/docs
- Express on Vercel: https://vercel.com/docs/functions/serverless-functions/runtimes/node-js

