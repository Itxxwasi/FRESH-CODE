# Development Guide - No Cache, Auto-Refresh Setup

This guide explains how to develop with automatic cache-busting and server auto-restart.

## ✅ What's Been Configured

### 1. **Automatic Cache-Busting**
- All API routes automatically disable caching in development mode
- HTML files have cache-busting query parameters (`?v=timestamp`) added to CSS/JS files
- Static files (CSS, JS, images) are served with no-cache headers in development

### 2. **Auto-Restart Server (Nodemon)**
- Server automatically restarts when you change any backend file
- Watches: `server.js`, `routes/`, `models/`, `middleware/`, `services/`, `utils/`, `config/`
- No need to manually restart the server!

### 3. **Development Mode Detection**
- Automatically detects development vs production based on `NODE_ENV`
- All cache-busting features only work in development mode

## 🚀 How to Use

### Step 1: Install Nodemon (if not already installed)
```bash
cd backend
npm install
```

This will install `nodemon` as a dev dependency.

### Step 2: Set NODE_ENV in .env
Make sure your `backend/.env` file has:
```env
NODE_ENV=development
```

### Step 3: Start Development Server
```bash
npm run dev
```

This starts the server with nodemon, which will auto-restart on file changes.

### Step 4: Make Changes
1. **Edit any file** (HTML, CSS, JS, backend routes, etc.)
2. **Save the file**
3. **Refresh browser once** (F5 or Ctrl+R)
4. **Changes appear immediately!** ✨

## 📝 What Happens Automatically

### When You Edit Backend Files:
- Server automatically restarts (nodemon)
- All API routes return fresh data (no cache)
- Just refresh browser once

### When You Edit Frontend Files:
- HTML files get cache-busting query params injected
- CSS/JS files are served with no-cache headers
- Just refresh browser once

### When You Edit HTML Files:
- All `<link>` and `<script>` tags get `?v=timestamp` added
- Browser fetches fresh versions automatically
- Just refresh browser once

## 🔧 Manual Commands

### Start Server (Normal - No Auto-Restart)
```bash
npm start
```

### Start Server (Development - With Auto-Restart)
```bash
npm run dev
```

### Production Mode
Set in `.env`:
```env
NODE_ENV=production
```

In production, caching is enabled for performance.

## 🐛 Troubleshooting

### Changes Not Appearing?
1. **Check NODE_ENV**: Make sure `NODE_ENV=development` in `.env`
2. **Hard Refresh**: Try Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
3. **Check Server Logs**: Make sure server restarted after file change
4. **Clear Browser Cache**: As last resort, but shouldn't be needed

### Server Not Auto-Restarting?
1. Check if nodemon is installed: `npm list nodemon`
2. Make sure you're using `npm run dev` not `npm start`
3. Check `nodemon.json` config file exists

### Still Having Issues?
- Check browser console for errors
- Check server console for errors
- Verify file was saved
- Try stopping and restarting the server

## 📋 Files Modified

- `server.js` - Added cache-busting middleware and HTML injection
- `package.json` - Added nodemon dev dependency and dev script
- `nodemon.json` - Created nodemon configuration

## 🎯 Summary

**Before**: Edit file → Restart server → Clear browser cache → Refresh → See changes

**Now**: Edit file → Refresh browser once → See changes immediately! ✨

No more restarting server or clearing cache needed!

