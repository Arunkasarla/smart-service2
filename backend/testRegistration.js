/**
 * Registration Test Tool
 * Run: node testRegistration.js
 *
 * This tool registers test users to populate the database
 * so login can be tested properly.
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

console.log('📝 REGISTRATION TEST TOOL');
console.log('═══════════════════════════════════════════════');

// Check environment
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';
const dbDir = isRender ? '/opt/render/project/src/backend' : path.join(__dirname);
const dbPath = path.join(dbDir, 'smartservice.db');

console.log('📋 Environment Info:');
console.log('  Platform:', isRender ? 'Render (Production)' : 'Local Development');
console.log('  Database Path:', dbPath);
console.log('  Database Exists:', fs.existsSync(dbPath) ? '✅ YES' : '❌ NO');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ CRITICAL: Cannot connect to database!');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  console.log('✅ Database connection established');
  registerTestUsers();
});

async function registerTestUsers() {
  console.log('\n📝 REGISTERING TEST USERS');
  console.log('═══════════════════════════════════════════════');

  const testUsers = [
    {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      password: 'TestPassword123',
      role: 'user'
    },
    {
      name: 'Test Provider',
      email: 'provider@example.com',
      phone: '+1234567891',
      password: 'ProviderPassword123',
      role: 'provider',
      provider_category: 'Plumbing',
      location: 'Test City',
      lat: 40.7128,
      lng: -74.0060,
      experience: 5
    },
    {
      name: 'Test Admin',
      email: 'admin@example.com',
      phone: '+1234567892',
      password: 'AdminPassword123',
      role: 'admin'
    }
  ];

  let registeredCount = 0;

  for (const userData of testUsers) {
    try {
      console.log(`\n📝 Registering: ${userData.name} (${userData.email})`);

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      console.log('   Password hashed successfully');

      // Generate referral code
      const referralCode = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('   Referral code generated:', referralCode);

      // Insert user
      const sql = `
        INSERT INTO users (
          name, email, phone, password, role, provider_category,
          location, lat, lng, experience, referral_code,
          wallet_balance, is_banned, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        userData.name,
        userData.email,
        userData.phone,
        hashedPassword,
        userData.role,
        userData.provider_category || null,
        userData.location || null,
        userData.lat || null,
        userData.lng || null,
        userData.experience || null,
        referralCode,
        0, // wallet_balance
        0, // is_banned
        new Date().toISOString()
      ];

      await new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            console.error('❌ Registration failed:', err.message);
            reject(err);
          } else {
            console.log('✅ Registration successful - User ID:', this.lastID);
            registeredCount++;
            resolve();
          }
        });
      });

    } catch (error) {
      console.error('❌ Error registering user:', error.message);
    }
  }

  console.log('\n📊 REGISTRATION SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Successfully registered ${registeredCount} test users`);

  // Verify users were created
  console.log('\n📝 VERIFYING REGISTERED USERS');
  console.log('═══════════════════════════════════════════════');

  db.all('SELECT id, name, email, role, referral_code FROM users ORDER BY id', (err, users) => {
    if (err) {
      console.error('❌ Cannot verify users:', err.message);
    } else {
      console.log(`   Found ${users.length} users in database:`);
      users.forEach(user => {
        console.log(`     • ID ${user.id}: ${user.name} (${user.email}) - ${user.role} - ${user.referral_code}`);
      });
    }

    console.log('\n🎯 TEST LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════');
    console.log('Use these credentials to test login:');
    console.log('');
    console.log('User Account:');
    console.log('  Email: test@example.com');
    console.log('  Password: TestPassword123');
    console.log('');
    console.log('Provider Account:');
    console.log('  Email: provider@example.com');
    console.log('  Password: ProviderPassword123');
    console.log('');
    console.log('Admin Account:');
    console.log('  Email: admin@example.com');
    console.log('  Password: AdminPassword123');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. Run login diagnostic: node debugLogin.js');
    console.log('2. Test login API with these credentials');
    console.log('3. Deploy to production');

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
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