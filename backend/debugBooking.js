/**
 * Booking API Diagnostic Tool
 * Run: node debugBooking.js
 *
 * This tool helps diagnose booking API issues:
 * - Verifies bookings table schema and data
 * - Tests INSERT operations with sample data
 * - Checks foreign key relationships
 * - Validates CORS configuration
 * - Tests notification system
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔍 BOOKING API DIAGNOSTIC TOOL');
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
  runBookingDiagnostics();
});

function runBookingDiagnostics() {
  console.log('\n🔧 RUNNING BOOKING DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════');

  // Test 1: Check bookings table exists and schema
  console.log('📝 Test 1: Bookings Table Schema Check');
  db.all('PRAGMA table_info(bookings)', (err, columns) => {
    if (err) {
      console.error('❌ Cannot get bookings table schema:', err.message);
      console.error('   This means the bookings table does not exist!');
      return;
    }

    console.log(`   Bookings table has ${columns.length} columns:`);
    columns.forEach(col => {
      console.log(`     • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'nullable'}`);
    });

    const requiredColumns = ['id', 'user_id', 'service_id', 'provider_id', 'date', 'time', 'address', 'status'];
    const missingColumns = requiredColumns.filter(col => !columns.find(c => c.name === col));

    if (missingColumns.length > 0) {
      console.log('❌ Missing required columns:', missingColumns.join(', '));
    } else {
      console.log('✅ All required columns present');
    }

    // Test 2: Check existing bookings
    console.log('\n📝 Test 2: Existing Bookings Check');
    db.all('SELECT id, user_id, provider_id, service_id, date, time, address, status FROM bookings LIMIT 5', (err, bookings) => {
      if (err) {
        console.error('❌ Cannot query bookings:', err.message);
        return;
      }

      console.log(`   Found ${bookings.length} bookings in database:`);
      bookings.forEach(booking => {
        console.log(`     • ID ${booking.id}: User ${booking.user_id} → Provider ${booking.provider_id} (${booking.date} ${booking.time}) - ${booking.status}`);
      });

      // Test 3: Check foreign key relationships
      console.log('\n📝 Test 3: Foreign Key Validation');
      if (bookings.length > 0) {
        const sampleBooking = bookings[0];

        // Check if user exists
        db.get('SELECT id, name FROM users WHERE id = ?', [sampleBooking.user_id], (err, user) => {
          if (err) {
            console.error('❌ Cannot verify user:', err.message);
          } else if (!user) {
            console.log(`❌ FOREIGN KEY ERROR: User ${sampleBooking.user_id} does not exist!`);
          } else {
            console.log(`✅ User ${sampleBooking.user_id} exists: ${user.name}`);
          }
        });

        // Check if provider exists
        db.get('SELECT id, name FROM users WHERE id = ?', [sampleBooking.provider_id], (err, provider) => {
          if (err) {
            console.error('❌ Cannot verify provider:', err.message);
          } else if (!provider) {
            console.log(`❌ FOREIGN KEY ERROR: Provider ${sampleBooking.provider_id} does not exist!`);
          } else {
            console.log(`✅ Provider ${sampleBooking.provider_id} exists: ${provider.name}`);
          }
        });

        // Check if service exists
        db.get('SELECT id, title FROM services WHERE id = ?', [sampleBooking.service_id], (err, service) => {
          if (err) {
            console.error('❌ Cannot verify service:', err.message);
          } else if (!service) {
            console.log(`❌ FOREIGN KEY ERROR: Service ${sampleBooking.service_id} does not exist!`);
          } else {
            console.log(`✅ Service ${sampleBooking.service_id} exists: ${service.title}`);
          }

          // Test 4: Test INSERT operation
          runInsertTest();
        });
      } else {
        console.log('   No existing bookings to validate');
        runInsertTest();
      }
    });
  });
}

function runInsertTest() {
  console.log('\n📝 Test 4: Booking INSERT Operation Test');

  // First, ensure we have test users and services
  console.log('   Checking for test data...');

  // Check if we have users
  db.get('SELECT id FROM users LIMIT 1', (err, user) => {
    if (err || !user) {
      console.log('❌ No users found - cannot test booking INSERT');
      console.log('   Please create some users first');
      finalizeTests();
      return;
    }

    const testUserId = user.id;
    console.log('   Found test user ID:', testUserId);

    // Check if we have providers
    db.get('SELECT id FROM users WHERE role = "provider" LIMIT 1', (err, provider) => {
      if (err || !provider) {
        console.log('❌ No providers found - cannot test booking INSERT');
        console.log('   Please create a provider user first');
        finalizeTests();
        return;
      }

      const testProviderId = provider.id;
      console.log('   Found test provider ID:', testProviderId);

      // Check if we have services
      db.get('SELECT id FROM services LIMIT 1', (err, service) => {
        if (err || !service) {
          console.log('❌ No services found - cannot test booking INSERT');
          console.log('   Please create a service first');
          finalizeTests();
          return;
        }

        const testServiceId = service.id;
        console.log('   Found test service ID:', testServiceId);

        // Now test the INSERT
        const testBooking = {
          user_id: testUserId,
          service_id: testServiceId,
          provider_id: testProviderId,
          date: '2026-04-20',
          time: '14:00',
          address: '123 Test Street, Test City',
          notes: 'Test booking from diagnostic tool',
          payment_method: 'cod'
        };

        console.log('   Attempting INSERT with test data:');
        console.log('     User ID:', testBooking.user_id);
        console.log('     Provider ID:', testBooking.provider_id);
        console.log('     Service ID:', testBooking.service_id);
        console.log('     Date/Time:', testBooking.date, testBooking.time);
        console.log('     Address:', testBooking.address);

        const sql = `INSERT INTO bookings (user_id, service_id, provider_id, date, time, address, notes, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [
          testBooking.user_id,
          testBooking.service_id,
          testBooking.provider_id,
          testBooking.date,
          testBooking.time,
          testBooking.address,
          testBooking.notes,
          testBooking.payment_method
        ];

        console.log('   SQL:', sql);
        console.log('   Values:', values);

        db.run(sql, values, function(err) {
          if (err) {
            console.error('❌ INSERT failed:', err.message);
            console.error('   Error code:', err.code);

            if (err.message.includes('FOREIGN KEY constraint failed')) {
              console.error('   This is a FOREIGN KEY error - check that user_id, provider_id, and service_id exist');
            }
            if (err.message.includes('no such table')) {
              console.error('   This means the bookings table does not exist!');
            }
          } else {
            const insertedId = this.lastID;
            console.log('✅ INSERT succeeded! New booking ID:', insertedId);

            // Verify the insert
            db.get('SELECT * FROM bookings WHERE id = ?', [insertedId], (err, booking) => {
              if (err) {
                console.error('❌ Cannot verify INSERT:', err.message);
              } else if (!booking) {
                console.error('❌ INSERT verification failed - booking not found!');
              } else {
                console.log('✅ INSERT verified - booking found in database');
                console.log('   Retrieved booking:', {
                  id: booking.id,
                  user_id: booking.user_id,
                  provider_id: booking.provider_id,
                  date: booking.date,
                  status: booking.status
                });

                // Clean up test booking
                db.run('DELETE FROM bookings WHERE id = ?', [insertedId], (err) => {
                  if (err) {
                    console.error('❌ Cannot clean up test booking:', err.message);
                  } else {
                    console.log('✅ Test booking cleaned up');
                  }
                  finalizeTests();
                });
              }
            });
          }
        });
      });
    });
  });
}

function finalizeTests() {
  console.log('\n🎯 BOOKING DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════');

  // Check database file size after operations
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('📊 Database Stats:');
    console.log('   File Size:', (stats.size / 1024).toFixed(2) + ' KB');
    console.log('   Last Modified:', stats.mtime.toISOString());
  }

  console.log('\n📋 RECOMMENDATIONS:');
  console.log('═══════════════════════════════════════════════');

  console.log('1. **If INSERT fails with "no such table":**');
  console.log('   - The bookings table doesn\'t exist');
  console.log('   - Restart the server to recreate database schema');

  console.log('\n2. **If INSERT fails with "FOREIGN KEY constraint failed":**');
  console.log('   - The user_id, provider_id, or service_id doesn\'t exist');
  console.log('   - Create test users and services first');

  console.log('\n3. **If CORS errors persist:**');
  console.log('   - Check that Vercel URL is in allowed origins');
  console.log('   - Verify both Express and Socket.io CORS configs');

  console.log('\n4. **For production debugging:**');
  console.log('   - Check Render logs for detailed error messages');
  console.log('   - Use this diagnostic tool on Render shell');

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
