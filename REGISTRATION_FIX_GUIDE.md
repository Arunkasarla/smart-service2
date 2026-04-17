# Registration Error Fix Guide

## Root Cause Analysis

Your 500 "Database error" was likely caused by one or more of these issues:

### 1. **Schema Mismatch** (Most Likely)
- Your deployed database didn't have all required columns
- The SQL ALTER TABLE statements may not have executed during initial deployment
- Columns like `profile_photo`, `referral_code`, `wallet_balance`, `referred_by` were missing

### 2. **Error Handling Issues**
- Generic "Database error" message made debugging difficult
- No logging of actual SQL errors
- Missing specific error case handling

### 3. **Referral Logic Race Condition**
- The referral balance update wasn't awaited, causing potential issues
- UNIQUE constraint on `referral_code` could fail if duplicates generated

---

## Changes Made

### ✅ **Fixed authRoutes.js**
- Added better error logging with error codes
- Improved error messages for specific cases (UNIQUE constraint, schema mismatch)
- Made referral balance update asynchronous with proper promises
- Added try-catch around referral processing

### ✅ **Fixed database.js**
- Updated CREATE TABLE to include all columns in initial creation
- Added NOT NULL and DEFAULT constraints properly
- Ensured ALTER TABLE statements have error handling

### ✅ **Added checkSchema.js**
- Diagnostic tool to verify schema on deployed server
- Tests actual INSERT query to catch issues early
- Provides specific fix instructions

---

## How to Deploy & Fix

### On Render Backend:

```bash
# 1. SSH into your Render container or redeploy with this command
npm install

# 2. Run schema diagnostic to verify
node backend/checkSchema.js

# 3. If columns are still missing, you have 2 options:

# Option A: Delete and recreate the database (all data will be lost)
rm backend/smartservice.db
node backend/server.js  # Will recreate with correct schema

# Option B: Keep existing data and manually add missing columns via console
# (Contact Render support for database console access)
```

---

## Best Practices to Avoid Future Issues

### 1. **Use Migration System** (Recommended for Production)
```javascript
// Create a migrations/ folder with numbered files
// migrations/001_create_users_table.js
// migrations/002_add_profile_fields.js
// migrations/003_add_referral_system.js

// Then run them sequentially on startup
```

### 2. **Database Initialization Checklist**
```
✅ Always include all columns in CREATE TABLE (not ALTER)
✅ Use proper constraints (NOT NULL, UNIQUE, DEFAULT)
✅ Add timestamps for audit trails
✅ Never assume schema after initial deployment
✅ Keep a backup schema file
```

### 3. **Error Handling Best Practices**
```javascript
// DO THIS:
if (err.message.includes('no such column')) {
  console.error('Schema mismatch - check database initialization');
  // Send specific error to client
}

// NOT THIS:
if (err) {
  return res.status(500).json({ message: 'Database error' });
}
```

### 4. **Testing Before Deployment**
```bash
# 1. Test registration locally
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "1234567890",
    "password": "Password123",
    "role": "user"
  }'

# 2. Check database schema
node checkSchema.js

# 3. Test file uploads
# (Upload with profile_photo form field)

# 4. Only then push to Render
```

### 5. **Production SQLite Considerations**
⚠️ **Important**: SQLite is not ideal for production with concurrent users.
Consider migrating to PostgreSQL on Render instead:

**Why PostgreSQL is better:**
- Handles concurrent requests better
- Better for file uploads (separate from DB)
- Native JSON support
- Better transaction handling

---

## Quick Fix Checklist

- [ ] Pull the updated code
- [ ] Run `npm install`
- [ ] Run `node backend/checkSchema.js` locally
- [ ] Test registration locally
- [ ] Push to Render
- [ ] Check Render logs for schema verification
- [ ] Test registration on deployed site

---

## File Upload Issue on Render

The `/uploads/` directory may not persist on Render with SQLite.

**Recommended Solution:**
1. Store only the filename in database
2. Use cloud storage (AWS S3, Cloudinary, Google Cloud Storage)
3. Or keep file path as relative: `uploads/filename.jpg`

**Minimal Fix (for now):**
```javascript
// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
```

---

## Debugging in Production

Enable these logs on Render:

```javascript
// In server.js
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// In routes
router.post('/register', (req, res) => {
  console.log('Register endpoint hit');
  console.log('Request body:', { ...req.body, password: '***' });
  // ... rest of code
});
```

Check Render logs:
- Render Dashboard → Your App → Logs
- Look for detailed error messages

---

## If Error Persists After Fix

1. **Check these files are updated:**
   - `backend/routes/authRoutes.js` ✅
   - `backend/database.js` ✅

2. **Run diagnostic:**
   ```bash
   node backend/checkSchema.js
   ```

3. **Check Render environment:**
   - Database file exists: `backend/smartservice.db`
   - Permissions are correct
   - Restart deployment (force redeploy)

4. **Nuclear option (will lose all data):**
   ```bash
   rm backend/smartservice.db
   # Redeploy - database will recreate with correct schema
   ```

---

## Additional Recommendations

1. **Add request validation:**
   ```javascript
   const { body, validationResult } = require('express-validator');
   
   router.post('/register', [
     body('email').isEmail(),
     body('password').isLength({ min: 8 }),
     body('name').notEmpty()
   ], (req, res) => {
     const errors = validationResult(req);
     if (!errors.isEmpty()) {
       return res.status(400).json({ errors: errors.array() });
     }
     // ... rest
   });
   ```

2. **Add rate limiting:**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5 // 5 registration attempts per 15 min
   });
   router.post('/register', limiter, ...);
   ```

3. **Monitor errors:**
   - Add Sentry.io or similar error tracking
   - Monitor registration success rate
   - Alert on 500 errors

---

## Summary

Your issue was solved by:
1. ✅ Ensuring all DB columns exist during creation
2. ✅ Adding detailed error logging
3. ✅ Providing schema diagnostic tool
4. ✅ Improving async/await handling for referrals

Test locally first with `checkSchema.js`, then deploy to Render.
