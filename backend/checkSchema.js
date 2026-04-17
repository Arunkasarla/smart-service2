/**
 * Database Schema Diagnostic Tool
 * Run: node checkSchema.js
 * This will verify all required columns exist in the users table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'smartservice.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database.');
    checkSchema();
  }
});

function checkSchema() {
  // Get table info
  db.all(`PRAGMA table_info(users)`, (err, rows) => {
    if (err) {
      console.error('❌ Error reading table schema:', err);
      process.exit(1);
    }

    console.log('\n📋 Current Users Table Schema:');
    console.log('═════════════════════════════════════════');
    
    const columns = {};
    rows.forEach(row => {
      columns[row.name] = {
        type: row.type,
        notnull: row.notnull === 1 ? 'NOT NULL' : 'nullable',
        default: row.dflt_value || 'none'
      };
      console.log(`  • ${row.name.padEnd(20)} | ${row.type.padEnd(10)} | ${row.notnull === 1 ? 'NOT NULL' : 'nullable'}`);
    });

    console.log('\n✅ Required columns check:');
    console.log('═════════════════════════════════════════');

    const requiredColumns = [
      'id', 'name', 'email', 'phone', 'password', 'role', 
      'provider_category', 'experience', 'profile_photo', 
      'referral_code', 'wallet_balance', 'referred_by'
    ];

    let allPresent = true;
    requiredColumns.forEach(col => {
      if (columns[col]) {
        console.log(`  ✅ ${col}`);
      } else {
        console.log(`  ❌ ${col} - MISSING!`);
        allPresent = false;
      }
    });

    if (allPresent) {
      console.log('\n✅ All required columns are present!');
    } else {
      console.log('\n⚠️  Some columns are missing. Run the following on your deployed server:');
      console.log('\nOr restart the application to trigger schema migrations.');
    }

    // Test a sample registration with detailed feedback
    console.log('\n🧪 Testing sample INSERT:');
    console.log('═════════════════════════════════════════');

    const testSql = `INSERT INTO users 
      (name, email, phone, password, role, provider_category, experience, profile_photo, referral_code, wallet_balance, referred_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(testSql, [
      'Test User',
      `test${Date.now()}@test.com`,
      '1234567890',
      'hashedpassword',
      'user',
      null,
      0,
      null,
      'REF-TEST123',
      0,
      null
    ], function(err) {
      if (err) {
        console.log(`  ❌ INSERT failed: ${err.message}`);
        console.log('\n📝 To fix, run these SQL commands on your deployed database:');
        console.log(`   SQLite: ALTER TABLE users ADD COLUMN <column_name> <type>;`);
      } else {
        console.log(`  ✅ INSERT successful! (Test record ID: ${this.lastID})`);
        console.log('  🗑️  Cleaning up test record...');
        
        // Delete test record
        db.run(`DELETE FROM users WHERE id = ?`, [this.lastID], (err) => {
          if (!err) {
            console.log('  ✅ Test record deleted.');
          }
          db.close(() => {
            console.log('\n✅ Schema check complete!');
            process.exit(0);
          });
        });
      }
    });
  });
}
