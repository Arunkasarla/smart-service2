const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const upload = require('../multerConfig'); // V3 Import

// Register User
router.post('/register', upload.single('profile_photo'), async (req, res) => {
  const { name, email, phone, password, role, provider_category, experience, referral_code } = req.body;
  const profile_photo = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newRefCode = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const userRole = role === 'provider' ? 'provider' : 'user';
    const category = userRole === 'provider' ? (provider_category || 'electrician') : null;
    const providerExperience = userRole === 'provider' ? (parseInt(experience) || 0) : null;

    // Handle referral logic
    let referrerId = null;
    let initialBalance = 0;
    if (referral_code) {
      try {
        const referrer = await new Promise((resolve) => {
          db.get(`SELECT id FROM users WHERE referral_code = ?`, [referral_code], (err, row) => resolve(row));
        });
        if (referrer) {
          referrerId = referrer.id;
          initialBalance = 50;
          // Update referrer's balance
          await new Promise((resolve, reject) => {
            db.run(`UPDATE users SET wallet_balance = wallet_balance + 50 WHERE id = ?`, [referrerId], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      } catch (refErr) {
        console.error('Referral processing error:', refErr.message);
      }
    }

    // Insert with minimal required columns first, then optional ones
    const sql = `INSERT INTO users 
      (name, email, phone, password, role, provider_category, experience, profile_photo, referral_code, wallet_balance, referred_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [name, email, phone, hashedPassword, userRole, category, providerExperience, profile_photo, newRefCode, initialBalance, referrerId], function (err) {
      if (err) {
        console.error('❌ REGISTRATION FAILED - Database INSERT error:');
        console.error('   Error message:', err.message);
        console.error('   Error code:', err.code);
        console.error('   SQL:', sql);
        console.error('   Values:', [name, email, phone, '***HASHED***', userRole, category, providerExperience, profile_photo, newRefCode, initialBalance, referrerId]);

        // Better error handling
        if (err.message.includes('UNIQUE constraint failed: users.email')) {
          return res.status(400).json({ message: 'Email already exists' });
        }
        if (err.message.includes('UNIQUE constraint failed: users.referral_code')) {
          return res.status(500).json({ message: 'Referral code generation error. Please try again.' });
        }
        if (err.message.includes('no such column')) {
          return res.status(500).json({ message: 'Database schema mismatch. Please contact support.' });
        }

        return res.status(500).json({ message: 'Database error', error: err.message });
      }

      // ✅ INSERT succeeded - now verify the data was actually saved
      const newUserId = this.lastID;
      console.log('✅ REGISTRATION SUCCESS - User inserted with ID:', newUserId);

      // Verify the user was actually saved by querying the database
      db.get('SELECT id, name, email, role, referral_code, wallet_balance FROM users WHERE id = ?', [newUserId], (verifyErr, user) => {
        if (verifyErr) {
          console.error('❌ VERIFICATION FAILED - Could not verify user was saved:', verifyErr.message);
          return res.status(500).json({ message: 'Registration verification failed' });
        }

        if (!user) {
          console.error('❌ VERIFICATION FAILED - User not found after INSERT!');
          console.error('   Expected ID:', newUserId);
          console.error('   This indicates a database persistence issue!');
          return res.status(500).json({ message: 'User registration failed - data not saved' });
        }

        console.log('✅ VERIFICATION SUCCESS - User confirmed in database:');
        console.log('   ID:', user.id);
        console.log('   Name:', user.name);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   Referral Code:', user.referral_code);
        console.log('   Wallet Balance:', user.wallet_balance);

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({
          message: 'User registered successfully',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            provider_category: category,
            experience: providerExperience,
            profile_photo,
            referral_code: user.referral_code,
            wallet_balance: user.wallet_balance
          }
        });
      });
    });
  } catch (error) {
    console.error('Server error during registration:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  console.log('🔐 LOGIN ATTEMPT RECEIVED');
  console.log('   Request Body:', JSON.stringify(req.body, null, 2));
  console.log('   Headers:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'origin': req.headers['origin']
  });

  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    console.log('❌ LOGIN VALIDATION FAILED - Missing fields');
    console.log('   Email provided:', !!email);
    console.log('   Password provided:', !!password);
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  console.log('✅ LOGIN VALIDATION PASSED');
  console.log('   Email:', email);
  console.log('   Password length:', password.length);

  try {
    // Check database connection first
    console.log('🔍 CHECKING DATABASE CONNECTION...');
    db.run('SELECT 1', (testErr) => {
      if (testErr) {
        console.error('❌ DATABASE CONNECTION TEST FAILED:', testErr.message);
        return res.status(500).json({ message: 'Database connection error' });
      }

      console.log('✅ DATABASE CONNECTION OK');

      // Now perform the actual login query
      console.log('🔍 EXECUTING USER LOOKUP QUERY...');
      const sql = `SELECT id, name, email, password, role, referral_code, wallet_balance, is_banned FROM users WHERE email = ?`;
      console.log('   SQL:', sql);
      console.log('   Email parameter:', email);

      db.get(sql, [email], async (err, user) => {
        if (err) {
          console.error('❌ DATABASE QUERY ERROR:');
          console.error('   Error message:', err.message);
          console.error('   Error code:', err.code);
          console.error('   SQL:', sql);
          console.error('   Parameters:', [email]);

          if (err.message.includes('no such table')) {
            console.error('❌ CRITICAL: users table does not exist!');
            return res.status(500).json({ message: 'Database schema error - users table missing' });
          }

          return res.status(500).json({ message: 'Database error during login' });
        }

        console.log('✅ DATABASE QUERY COMPLETED');
        console.log('   User found:', !!user);

        if (!user) {
          console.log('❌ USER NOT FOUND');
          console.log('   Searched for email:', email);
          console.log('   This could mean:');
          console.log('   - User never registered');
          console.log('   - User data was lost (database persistence issue)');
          console.log('   - Email case sensitivity issue');

          // Check if any users exist at all
          db.get('SELECT COUNT(*) as count FROM users', (countErr, result) => {
            if (!countErr) {
              console.log('   Total users in database:', result.count);
            }
          });

          return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('✅ USER FOUND IN DATABASE:');
        console.log('   ID:', user.id);
        console.log('   Name:', user.name);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   Is Banned:', user.is_banned);
        console.log('   Password hash exists:', !!user.password);
        console.log('   Password hash length:', user.password ? user.password.length : 0);

        // Check if user is banned
        if (user.is_banned === 1) {
          console.log('❌ USER IS BANNED');
          return res.status(403).json({ message: 'Account Terminated: You have been permanently banned by the Admin.' });
        }

        // Verify password
        console.log('🔐 STARTING PASSWORD VERIFICATION...');
        console.log('   Plain password length:', password.length);
        console.log('   Hashed password length:', user.password.length);

        try {
          const isMatch = await bcrypt.compare(password, user.password);
          console.log('✅ PASSWORD COMPARISON COMPLETED');
          console.log('   Password match result:', isMatch);

          if (!isMatch) {
            console.log('❌ PASSWORD MISMATCH');
            console.log('   Possible causes:');
            console.log('   - Wrong password entered');
            console.log('   - Password hashing inconsistency');
            console.log('   - Database corruption');
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          console.log('✅ PASSWORD VERIFICATION SUCCESSFUL');

          // Generate JWT token
          console.log('🎫 GENERATING JWT TOKEN...');
          const tokenPayload = { id: user.id, role: user.role };
          console.log('   Token payload:', tokenPayload);

          const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
          console.log('✅ JWT TOKEN GENERATED');
          console.log('   Token length:', token.length);
          console.log('   Token starts with:', token.substring(0, 20) + '...');

          // Prepare response user object (exclude password)
          const responseUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            referral_code: user.referral_code,
            wallet_balance: user.wallet_balance
          };

          console.log('📤 SENDING LOGIN SUCCESS RESPONSE');
          console.log('   Response user object:', responseUser);

          res.json({
            message: 'Login successful',
            token,
            user: responseUser
          });

        } catch (bcryptErr) {
          console.error('❌ BCRYPT COMPARISON ERROR:', bcryptErr.message);
          console.error('   This could mean:');
          console.error('   - bcrypt library issue');
          console.error('   - Corrupted password hash in database');
          console.error('   - Memory/timeout issue');
          return res.status(500).json({ message: 'Password verification error' });
        }
      });
    });

  } catch (serverErr) {
    console.error('❌ UNEXPECTED SERVER ERROR DURING LOGIN:', serverErr.message);
    console.error('   Stack trace:', serverErr.stack);
    return res.status(500).json({ message: 'Server error during login' });
  }
});
// Admin Registration (High Security)
router.post('/admin/register', async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;

    // Secure Passcode Required for Admin Registry
    if (adminSecret !== 'gravity99') {
       return res.status(403).json({ message: 'Unauthorized: Invalid Admin Secret Passcode.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
      if (user) {
        return res.status(400).json({ message: 'Admin with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.run(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [name, email, hashedPassword, 'admin'],
        function(err) {
          if (err) return res.status(500).json({ message: 'Database error' });

          const token = jwt.sign(
            { id: this.lastID, email, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '30d' }
          );

          res.status(201).json({
            token,
            user: { id: this.lastID, name, email, role: 'admin' }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
