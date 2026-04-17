/**
 * Database Debugging & Verification Tool
 * Run: node debugDatabase.js
 *
 * This tool helps diagnose SQLite database issues:
 * - Verifies database connection and file path
 * - Checks if tables exist and have correct schema
 * - Tests INSERT operations
 * - Verifies data persistence
 * - Checks for Render-specific issues
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔍 DATABASE DEBUGGING TOOL');
console.log('═══════════════════════════════════════════════');

// Check environment
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';
const dbDir = isRender ? '/opt/render/project/src/backend' : path.join(__dirname);
const dbPath = path.join(dbDir, 'smartservice.db');

console.log('📋 Environment Info:');
console.log('  Platform:', isRender ? 'Render (Production)' : 'Local Development');
console.log('  Database Directory:', dbDir);
console.log('  Database File:', dbPath);
console.log('  Directory Exists:', fs.existsSync(dbDir) ? '✅ YES' : '❌ NO');
console.log('  Database File Exists:', fs.existsSync(dbPath) ? '✅ YES' : '❌ NO');

// Get file stats if exists
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('  File Size:', (stats.size / 1024).toFixed(2) + ' KB');
  console.log('  Last Modified:', stats.mtime.toISOString());
}

// Create database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ CRITICAL: Cannot connect to database!');
    console.error('   Error:', err.message);
    console.error('   Path:', dbPath);
    console.error('   Directory writable:', fs.existsSync(dbDir) ? 'YES' : 'NO');
    process.exit(1);
  }

  console.log('✅ Database connection established');
  runDiagnostics();
});

function runDiagnostics() {
  console.log('\n🔧 RUNNING DATABASE DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════');

  // Test 1: Basic database operations
  console.log('📝 Test 1: Basic Database Operations');
  db.run('SELECT 1 as test', (err, row) => {
    if (err) {
      console.error('❌ Basic SELECT failed:', err.message);
    } else {
      console.log('✅ Basic SELECT works');
    }
  });

  // Test 2: Check tables exist
  console.log('\n📝 Test 2: Table Existence Check');
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Cannot list tables:', err.message);
      return;
    }

    const tableNames = tables.map(t => t.name);
    console.log('   Found tables:', tableNames.join(', '));

    const requiredTables = ['users', 'services', 'bookings', 'notifications', 'warranties', 'invoices', 'reviews', 'messages', 'blocked_dates'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
    } else {
      console.log('✅ All required tables exist');
    }

    // Test 3: Check users table schema
    if (tableNames.includes('users')) {
      console.log('\n📝 Test 3: Users Table Schema Check');
      db.all('PRAGMA table_info(users)', (err, columns) => {
        if (err) {
          console.error('❌ Cannot get users table schema:', err.message);
          return;
        }

        console.log(`   Users table has ${columns.length} columns:`);
        columns.forEach(col => {
          console.log(`     • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'nullable'}`);
        });

        const requiredColumns = ['id', 'name', 'email', 'password', 'role', 'referral_code', 'wallet_balance'];
        const missingColumns = requiredColumns.filter(col => !columns.find(c => c.name === col));

        if (missingColumns.length > 0) {
          console.log('❌ Missing required columns:', missingColumns.join(', '));
        } else {
          console.log('✅ All required columns present');
        }

        // Test 4: Check existing users
        console.log('\n📝 Test 4: Existing Users Check');
        db.all('SELECT id, name, email, role, referral_code, wallet_balance FROM users LIMIT 5', (err, users) => {
          if (err) {
            console.error('❌ Cannot query users:', err.message);
            return;
          }

          console.log(`   Found ${users.length} users in database:`);
          users.forEach(user => {
            console.log(`     • ID ${user.id}: ${user.name} (${user.email}) - ${user.role} - Balance: ₹${user.wallet_balance}`);
          });

          // Test 5: Test INSERT operation
          console.log('\n📝 Test 5: INSERT Operation Test');
          const testEmail = `test-${Date.now()}@debug.com`;
          const testSql = `INSERT INTO users (name, email, password, role, referral_code, wallet_balance) VALUES (?, ?, ?, ?, ?, ?)`;
          const testValues = ['Debug Test User', testEmail, 'hashedpassword', 'user', `DEBUG-${Date.now()}`, 0];

          console.log('   Attempting INSERT with:');
          console.log('     Name:', testValues[0]);
          console.log('     Email:', testValues[1]);
          console.log('     Role:', testValues[3]);
          console.log('     Referral Code:', testValues[4]);

          db.run(testSql, testValues, function(err) {
            if (err) {
              console.error('❌ INSERT failed:', err.message);
              console.error('   SQL:', testSql);
              console.error('   Values:', testValues);
            } else {
              const insertedId = this.lastID;
              console.log('✅ INSERT succeeded! New user ID:', insertedId);

              // Verify the insert
              db.get('SELECT * FROM users WHERE id = ?', [insertedId], (err, user) => {
                if (err) {
                  console.error('❌ Cannot verify INSERT:', err.message);
                } else if (!user) {
                  console.error('❌ INSERT verification failed - user not found!');
                } else {
                  console.log('✅ INSERT verified - user found in database');
                  console.log('   Retrieved user:', { id: user.id, name: user.name, email: user.email });

                  // Clean up test user
                  db.run('DELETE FROM users WHERE id = ?', [insertedId], (err) => {
                    if (err) {
                      console.error('❌ Cannot clean up test user:', err.message);
                    } else {
                      console.log('✅ Test user cleaned up');
                    }
                    finalizeTests();
                  });
                }
              });
            }
          });
        });
      });
    } else {
      console.log('❌ Users table does not exist!');
      finalizeTests();
    }
  });
}

function finalizeTests() {
  console.log('\n🎯 DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════');

  // Check database file size after operations
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('📊 Final Database Stats:');
    console.log('   File Size:', (stats.size / 1024).toFixed(2) + ' KB');
    console.log('   Last Modified:', stats.mtime.toISOString());
  }

  // Check if we're on Render and provide specific advice
  if (isRender) {
    console.log('\n🌐 RENDER-SPECIFIC NOTES:');
    console.log('   • Render uses ephemeral filesystem');
    console.log('   • Database files are lost on redeploy');
    console.log('   • Consider using PostgreSQL for production');
    console.log('   • Use persistent storage paths: /opt/render/project/src/');
  }

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
