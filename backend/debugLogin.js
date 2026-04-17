/**
 * Login API Diagnostic Tool
 * Run: node debugLogin.js
 *
 * This tool helps diagnose login API issues:
 * - Verifies users table and data
 * - Tests user lookup by email
 * - Tests password hashing/verification
 * - Tests JWT token generation
 * - Provides step-by-step debugging
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

console.log('🔐 LOGIN API DIAGNOSTIC TOOL');
console.log('═══════════════════════════════════════════════');

// Check environment
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';
const dbDir = isRender ? '/opt/render/project/src/backend' : path.join(__dirname);
const dbPath = path.join(dbDir, 'smartservice.db');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

console.log('📋 Environment Info:');
console.log('  Platform:', isRender ? 'Render (Production)' : 'Local Development');
console.log('  Database Path:', dbPath);
console.log('  Database Exists:', fs.existsSync(dbPath) ? '✅ YES' : '❌ NO');
console.log('  JWT Secret Configured:', !!process.env.JWT_SECRET ? '✅ YES' : '⚠️  NO (using fallback)');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ CRITICAL: Cannot connect to database!');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  console.log('✅ Database connection established');
  runLoginDiagnostics();
});

function runLoginDiagnostics() {
  console.log('\n🔧 RUNNING LOGIN DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════');

  // Test 1: Check users table exists and schema
  console.log('📝 Test 1: Users Table Schema Check');
  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (err) {
      console.error('❌ Cannot get users table schema:', err.message);
      console.error('   This means the users table does not exist!');
      return;
    }

    console.log(`   Users table has ${columns.length} columns:`);
    columns.forEach(col => {
      console.log(`     • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'nullable'}`);
    });

    const requiredColumns = ['id', 'name', 'email', 'password', 'role'];
    const missingColumns = requiredColumns.filter(col => !columns.find(c => c.name === col));

    if (missingColumns.length > 0) {
      console.log('❌ Missing required columns:', missingColumns.join(', '));
    } else {
      console.log('✅ All required columns present');
    }

    // Test 2: Check existing users
    console.log('\n📝 Test 2: Existing Users Check');
    db.all('SELECT id, name, email, role, is_banned FROM users LIMIT 10', (err, users) => {
      if (err) {
        console.error('❌ Cannot query users:', err.message);
        return;
      }

      console.log(`   Found ${users.length} users in database:`);
      users.forEach(user => {
        console.log(`     • ID ${user.id}: ${user.name} (${user.email}) - ${user.role} ${user.is_banned ? '[BANNED]' : ''}`);
      });

      if (users.length === 0) {
        console.log('❌ NO USERS FOUND IN DATABASE!');
        console.log('   This explains login failures - no users to authenticate against');
        console.log('   Solutions:');
        console.log('   1. Register some users first');
        console.log('   2. Check if database was recreated (data lost)');
        console.log('   3. Verify registration API is working');
        finalizeTests();
        return;
      }

      // Test 3: Test user lookup by email
      const testUser = users[0]; // Use first user for testing
      console.log('\n📝 Test 3: User Lookup by Email Test');
      console.log('   Testing with user:', testUser.email);

      db.get('SELECT id, name, email, password, role, is_banned FROM users WHERE email = ?', [testUser.email], (err, user) => {
        if (err) {
          console.error('❌ User lookup failed:', err.message);
          return;
        }

        if (!user) {
          console.error('❌ User lookup returned null!');
          return;
        }

        console.log('✅ User lookup successful:');
        console.log('   ID:', user.id);
        console.log('   Name:', user.name);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   Is Banned:', user.is_banned);
        console.log('   Password hash exists:', !!user.password);
        console.log('   Password hash length:', user.password ? user.password.length : 0);

        // Test 4: Test password hashing/verification
        console.log('\n📝 Test 4: Password Hashing Test');

        // Test bcrypt functionality
        const testPassword = 'TestPassword123';
        console.log('   Testing bcrypt with password:', testPassword);

        bcrypt.hash(testPassword, 10, (hashErr, hash) => {
          if (hashErr) {
            console.error('❌ Password hashing failed:', hashErr.message);
            return;
          }

          console.log('✅ Password hashing successful');
          console.log('   Hash length:', hash.length);
          console.log('   Hash starts with:', hash.substring(0, 20) + '...');

          // Test password comparison
          bcrypt.compare(testPassword, hash, (compareErr, isMatch) => {
            if (compareErr) {
              console.error('❌ Password comparison failed:', compareErr.message);
              return;
            }

            console.log('✅ Password comparison test:', isMatch ? 'SUCCESS' : 'FAILED');

            if (!isMatch) {
              console.error('❌ CRITICAL: bcrypt compare failed even with correct password!');
              console.error('   This indicates a bcrypt library issue');
            }

            // Test 5: Test JWT generation
            console.log('\n📝 Test 5: JWT Token Generation Test');
            const tokenPayload = { id: user.id, role: user.role };
            console.log('   Token payload:', tokenPayload);

            try {
              const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
              console.log('✅ JWT token generation successful');
              console.log('   Token length:', token.length);
              console.log('   Token starts with:', token.substring(0, 20) + '...');

              // Test token verification
              const decoded = jwt.verify(token, JWT_SECRET);
              console.log('✅ JWT token verification successful');
              console.log('   Decoded payload:', decoded);

            } catch (jwtErr) {
              console.error('❌ JWT operation failed:', jwtErr.message);
              console.error('   Check JWT_SECRET configuration');
            }

            // Test 6: Simulate full login process
            console.log('\n📝 Test 6: Full Login Simulation');
            simulateLoginProcess(testUser.email, testPassword, (loginResult) => {
              console.log('   Login simulation result:', loginResult.success ? 'SUCCESS' : 'FAILED');
              if (!loginResult.success) {
                console.log('   Error:', loginResult.error);
              }
              finalizeTests();
            });

          });
        });
      });
    });
  });
}

function simulateLoginProcess(email, password, callback) {
  console.log('   Simulating login for:', email);

  // Step 1: User lookup
  db.get('SELECT id, name, email, password, role, is_banned FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      callback({ success: false, error: 'Database error: ' + err.message });
      return;
    }

    if (!user) {
      callback({ success: false, error: 'User not found' });
      return;
    }

    if (user.is_banned === 1) {
      callback({ success: false, error: 'User is banned' });
      return;
    }

    // Step 2: Password verification
    bcrypt.compare(password, user.password, (compareErr, isMatch) => {
      if (compareErr) {
        callback({ success: false, error: 'Password comparison error: ' + compareErr.message });
        return;
      }

      if (!isMatch) {
        callback({ success: false, error: 'Password mismatch' });
        return;
      }

      // Step 3: JWT generation
      try {
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        callback({
          success: true,
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          token: token.substring(0, 20) + '...'
        });
      } catch (jwtErr) {
        callback({ success: false, error: 'JWT generation error: ' + jwtErr.message });
      }
    });
  });
}

function finalizeTests() {
  console.log('\n🎯 LOGIN DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════');

  // Check database file size after operations
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('📊 Database Stats:');
    console.log('   File Size:', (stats.size / 1024).toFixed(2) + ' KB');
    console.log('   Last Modified:', stats.mtime.toISOString());
  }

  console.log('\n📋 COMMON LOGIN FAILURE CAUSES:');
  console.log('═══════════════════════════════════════════════');

  console.log('1. **"User not found"**:');
  console.log('   - No users in database (check registration)');
  console.log('   - Email case sensitivity');
  console.log('   - Database persistence issues (Render)');

  console.log('\n2. **"Password mismatch"**:');
  console.log('   - Wrong password entered');
  console.log('   - Password hashing inconsistency');
  console.log('   - bcrypt library issues');

  console.log('\n3. **"Database error"**:');
  console.log('   - Database connection issues');
  console.log('   - Table/column missing');
  console.log('   - SQLite file corruption');

  console.log('\n4. **500 Internal Server Error**:');
  console.log('   - Unhandled exceptions in code');
  console.log('   - Missing error handling');
  console.log('   - Async/await issues');

  console.log('\n🔧 DEBUGGING STEPS:');
  console.log('═══════════════════════════════════════════════');

  console.log('1. Run this diagnostic: node debugLogin.js');
  console.log('2. Check Render logs for detailed error messages');
  console.log('3. Test registration first to ensure users exist');
  console.log('4. Verify JWT_SECRET is set in environment');
  console.log('5. Check bcrypt version compatibility');

  console.log('\n✅ Diagnostics complete!');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, closing database...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    }
    process.exit(0);
  });
});
