# Environment Variables Setup Guide

## Quick Setup

1. **Create a `.env` file** in the `backend/` directory
2. **Copy the content below** into your `.env` file
3. **Replace the placeholder values** with your actual credentials

---

## .env File Content

```env
# D.Watson Pharmacy E-Commerce Backend Environment Variables

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
MONGODB_URI=mongodb+srv://wasidev710_db_user:5xwzp9OQcJkMe1Tu@cluster0.ycj6rnq.mongodb.net/mydatabse?retryWrites=true&w=majority&appName=Cluster0

# Optional: Live/Main database URI for syncing
LIVE_MONGODB_URI=

# ==========================================
# JWT AUTHENTICATION
# ==========================================
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# ==========================================
# ADMIN USER
# ==========================================
ADMIN_EMAIL=admin@dwatson.pk
ADMIN_PASSWORD=admin123

# ==========================================
# CLOUDINARY IMAGE UPLOAD
# ==========================================
# Get these from: https://cloudinary.com/console
# Step 1: Sign up at https://cloudinary.com
# Step 2: Go to Dashboard
# Step 3: Copy your Cloud Name, API Key, and API Secret

# ==========================================
# SERVER CONFIGURATION
# ==========================================
PORT=5000
NODE_ENV=development
```

---

## How to Get Cloudinary Credentials

1. **Sign up** at [cloudinary.com](https://cloudinary.com) (Free account available)
2. **Go to Dashboard** after logging in
3. **Copy these values:**
   - **Cloud Name**: Found at the top of the dashboard
   - **API Key**: Found in "Account Details" section
   - **API Secret**: Found in "Account Details" section (click "Reveal" to see it)

4. **Replace** the placeholder values in your `.env` file:
   ```env
   CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
   CLOUDINARY_API_KEY=your_actual_api_key
   CLOUDINARY_API_SECRET=your_actual_api_secret
   ```

---

## Important Notes

- ✅ The `.env` file is already in `.gitignore` (won't be committed to Git)
- ✅ Never commit your `.env` file to version control
- ✅ Use different credentials for development and production
- ✅ Change `JWT_SECRET` to a strong random string in production
- ✅ Change `ADMIN_PASSWORD` to a secure password in production

---

## After Setting Up

1. **Install Cloudinary package** (if not already installed):
   ```bash
   npm install cloudinary
   ```

2. **Restart your server** to load the new environment variables:
   ```bash
   npm start
   ```

3. **Verify Cloudinary is configured** - Check server logs for:
   ```
   ✅ Cloudinary configured successfully
   ```

---

## Example .env File (Production)

For production, use stronger values:

```env
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=super_strong_random_string_min_32_chars
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=strong_secure_password_123!
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
PORT=5000
NODE_ENV=production
```

