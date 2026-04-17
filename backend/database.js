const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// For Render deployment, use persistent storage path
// Render provides /opt/render/project/src for persistent storage
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';
const dbDir = isRender ? '/opt/render/project/src/backend' : __dirname;
const dbPath = path.join(dbDir, 'smartservice.db');

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('🔍 Database Configuration:');
console.log('  Environment:', isRender ? 'Render (Production)' : 'Local Development');
console.log('  Database Path:', dbPath);
console.log('  Directory Exists:', fs.existsSync(dbDir));
console.log('  Database File Exists:', fs.existsSync(dbPath));

// Create database connection with proper error handling
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ CRITICAL: Database connection failed:', err.message);
    console.error('❌ Database path:', dbPath);
    console.error('❌ Directory permissions:', fs.existsSync(dbDir) ? 'OK' : 'MISSING');
    process.exit(1); // Exit if database connection fails
  } else {
    console.log('✅ Database connected successfully at:', dbPath);

    // Verify database is writable
    db.run('SELECT 1', (err) => {
      if (err) {
        console.error('❌ Database is not writable:', err.message);
      } else {
        console.log('✅ Database is writable');
        initDb();
      }
    });
  }
});

// Add error event handler
db.on('error', (err) => {
  console.error('❌ Database error event:', err.message);
});

// Add close event handler
db.on('close', () => {
  console.log('ℹ️  Database connection closed');
});

function initDb() {
  console.log('🔧 Initializing database schema...');

  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) console.error('❌ Failed to enable foreign keys:', err.message);
      else console.log('✅ Foreign keys enabled');
    });

    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) console.error('❌ Failed to set WAL mode:', err.message);
      else console.log('✅ WAL mode enabled');
    });

    // Users table - Comprehensive schema with all columns
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        provider_category TEXT,
        location TEXT,
        lat REAL,
        lng REAL,
        profile_photo TEXT,
        experience INTEGER DEFAULT 0,
        is_banned BOOLEAN DEFAULT 0,
        referral_code TEXT UNIQUE,
        wallet_balance REAL DEFAULT 0,
        referred_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(createUsersTable, (err) => {
      if (err) {
        console.error('❌ Failed to create users table:', err.message);
        return;
      }
      console.log('✅ Users table created/verified');

      // Verify table structure
      db.all(`PRAGMA table_info(users)`, (err, columns) => {
        if (err) {
          console.error('❌ Failed to verify table structure:', err.message);
        } else {
          console.log(`📋 Users table has ${columns.length} columns:`);
          columns.forEach(col => {
            console.log(`   • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'nullable'}`);
          });
        }
      });
    });

    // Self-healing migrations for existing V1/V2 bookings
    db.run(`ALTER TABLE bookings ADD COLUMN payment_method TEXT DEFAULT 'cash'`, (err) => { /* Ignore if already exists */});
    db.run(`ALTER TABLE bookings ADD COLUMN proof_image TEXT`, (err) => { /* Ignore if already exists */});
    db.run(`ALTER TABLE bookings ADD COLUMN warranty_expires DATETIME`, (err) => { /* Ignore if already exists */});
    db.run(`ALTER TABLE bookings ADD COLUMN warranty_revisit_requested BOOLEAN DEFAULT 0`, (err) => { /* Ignore if already exists */});

    // Services table
    db.run(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER,
      category TEXT,
      title TEXT,
      description TEXT,
      price REAL,
      image TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(provider_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create services table:', err.message);
      else console.log('✅ Services table created/verified');
    });

    // Bookings table with all columns
    const createBookingsTable = `
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        service_id INTEGER,
        provider_id INTEGER,
        date TEXT,
        time TEXT,
        address TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        payment_method TEXT DEFAULT 'cash',
        proof_image TEXT,
        warranty_expires DATETIME,
        warranty_revisit_requested BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(service_id) REFERENCES services(id),
        FOREIGN KEY(provider_id) REFERENCES users(id)
      )
    `;

    db.run(createBookingsTable, (err) => {
      if (err) console.error('❌ Failed to create bookings table:', err.message);
      else console.log('✅ Bookings table created/verified');
    });

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create notifications table:', err.message);
      else console.log('✅ Notifications table created/verified');
    });

    // Warranty table
    db.run(`CREATE TABLE IF NOT EXISTS warranties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER UNIQUE,
      warranty_days INTEGER,
      expiry_date DATETIME,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create warranties table:', err.message);
      else console.log('✅ Warranties table created/verified');
    });

    // Invoice table
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER UNIQUE,
      user_id INTEGER,
      provider_id INTEGER,
      service_id INTEGER,
      invoice_number TEXT UNIQUE,
      amount REAL,
      payment_method TEXT,
      invoice_date DATETIME,
      pdf_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create invoices table:', err.message);
      else console.log('✅ Invoices table created/verified');
    });

    // Reviews table
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      user_id INTEGER,
      provider_id INTEGER,
      rating INTEGER,
      comment TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(provider_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create reviews table:', err.message);
      else console.log('✅ Reviews table created/verified');
    });

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id),
      FOREIGN KEY(receiver_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create messages table:', err.message);
      else console.log('✅ Messages table created/verified');
    });

    // Blocked Dates table
    db.run(`CREATE TABLE IF NOT EXISTS blocked_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER,
      date TEXT,
      FOREIGN KEY(provider_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('❌ Failed to create blocked_dates table:', err.message);
      else console.log('✅ Blocked dates table created/verified');
    });

    console.log('🎉 Database initialization complete!');
  });
}

module.exports = db;
