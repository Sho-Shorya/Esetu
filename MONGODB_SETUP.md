# MongoDB Atlas Setup Guide

## Complete Steps to Connect MongoDB Atlas

### 1. **Login to MongoDB Atlas**
   - Go to: https://cloud.mongodb.com
   - Login with your account credentials

### 2. **Get Your Connection String**
   
   a) From the Clusters page, click the **"CONNECT"** button on your cluster
   
   b) Select **"Connect your application"**
   
   c) Choose **"Node.js"** version 3.0 or later
   
   d) You'll see a connection string like:
   ```
   mongodb+srv://<username>:<password>@cluster0.ureyaar.mongodb.net/?retryWrites=true&w=majority
   ```

### 3. **Fill in Your Credentials**

   Your connection string should look like:
   ```
   mongodb+srv://your-actual-username:your-actual-password@cluster0.ureyaar.mongodb.net/ekart_db?retryWrites=true&w=majority
   ```

   Replace:
   - `your-actual-username` → Your MongoDB Atlas username
   - `your-actual-password` → Your MongoDB Atlas password
   - Database name stays: `ekart_db`

### 4. **Add IP to Network Access**

   This is CRITICAL! Without this, connection will timeout.
   
   a) Go to MongoDB Atlas Dashboard
   
   b) Click **"Network Access"** (left sidebar)
   
   c) Click **"ADD IP ADDRESS"**
   
   d) Choose one of these:
      - **For Local Testing**: Click "Add My Current IP Address"
      - **For Production**: Add `0.0.0.0/0` (allows all IPs)
   
   e) Click **"Confirm"**

### 5. **Update Backend .env File**

   After getting your credentials, update:
   ```
   backend/.env
   ```
   With your actual MongoDB URI

### 6. **Test the Connection**

   a) Stop the backend (Ctrl+C if running)
   
   b) Start it again:
   ```bash
   cd backend
   npm run start
   ```
   
   c) You should see:
   ```
   Server started successfully
   Server running on port 8000
   MongoDB connected successfully
   ```

### Common Issues:

❌ **"authentication failed"** → Wrong username/password
❌ **"connection timed out"** → IP not whitelisted on MongoDB Atlas
❌ **"connection refused"** → MongoDB URI format incorrect

✅ **Success** → No error messages, server running
