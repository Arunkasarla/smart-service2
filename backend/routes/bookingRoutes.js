const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const db = require('../database');
const upload = require('../multerConfig');
const { createInvoiceForBooking } = require('../controllers/invoiceController');
const router = express.Router();

// User: Create a booking
router.post('/', authMiddleware, restrictTo('user'), (req, res) => {
  console.log('📝 BOOKING REQUEST RECEIVED');
  console.log('   User ID:', req.user?.id);
  console.log('   Request Body:', JSON.stringify(req.body, null, 2));

  const { service_id, provider_id, date, time, address, notes, payment_method } = req.body;
  const user_id = req.user.id;

  // Validate required fields
  const requiredFields = { service_id, provider_id, date, time, address };
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missingFields.length > 0) {
    console.error('❌ BOOKING VALIDATION FAILED - Missing fields:', missingFields);
    return res.status(400).json({
      message: 'Missing required fields',
      missingFields,
      receivedFields: Object.keys(req.body)
    });
  }

  // Validate data types
  if (isNaN(service_id) || isNaN(provider_id)) {
    console.error('❌ BOOKING VALIDATION FAILED - Invalid IDs:', { service_id, provider_id });
    return res.status(400).json({ message: 'service_id and provider_id must be valid numbers' });
  }

  console.log('✅ BOOKING VALIDATION PASSED');
  console.log('   Final data to insert:', {
    user_id, service_id, provider_id, date, time, address, notes, payment_method
  });

  const sql = `INSERT INTO bookings (user_id, service_id, provider_id, date, time, address, notes, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [user_id, service_id, provider_id, date, time, address, notes || '', payment_method || 'cod'];

  console.log('🔍 EXECUTING SQL:', sql);
  console.log('🔍 SQL VALUES:', values);

  db.run(sql, values, function(err) {
    if (err) {
      console.error('❌ BOOKING INSERT FAILED:');
      console.error('   Error message:', err.message);
      console.error('   Error code:', err.code);
      console.error('   SQL:', sql);
      console.error('   Values:', values);

      // Specific error handling
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        if (err.message.includes('user_id')) {
          return res.status(400).json({ message: 'Invalid user ID' });
        }
        if (err.message.includes('provider_id')) {
          return res.status(400).json({ message: 'Invalid provider ID' });
        }
        if (err.message.includes('service_id')) {
          return res.status(400).json({ message: 'Invalid service ID' });
        }
        return res.status(400).json({ message: 'Invalid foreign key reference' });
      }

      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'Duplicate booking' });
      }

      if (err.message.includes('no such table')) {
        console.error('❌ CRITICAL: bookings table does not exist!');
        return res.status(500).json({ message: 'Database schema error - bookings table missing' });
      }

      return res.status(500).json({
        message: 'Database error creating booking',
        error: err.message,
        code: err.code
      });
    }

    const bookingId = this.lastID;
    console.log('✅ BOOKING INSERT SUCCESS - ID:', bookingId);

    // Verify the booking was actually saved
    db.get('SELECT * FROM bookings WHERE id = ?', [bookingId], (verifyErr, booking) => {
      if (verifyErr) {
        console.error('❌ BOOKING VERIFICATION FAILED:', verifyErr.message);
        return res.status(500).json({ message: 'Booking verification failed' });
      }

      if (!booking) {
        console.error('❌ BOOKING VERIFICATION FAILED - Booking not found after insert!');
        return res.status(500).json({ message: 'Booking was not saved to database' });
      }

      console.log('✅ BOOKING VERIFICATION SUCCESS:', {
        id: booking.id,
        user_id: booking.user_id,
        provider_id: booking.provider_id,
        date: booking.date,
        status: booking.status
      });

      // Save Notification to DB
      const message = `New booking request from user ID ${user_id} on ${date} at ${time}.`;
      db.run(`INSERT INTO notifications (user_id, content) VALUES (?, ?)`, [provider_id, message], (notifyErr) => {
        if (notifyErr) {
          console.error('❌ NOTIFICATION INSERT FAILED:', notifyErr.message);
        } else {
          console.log('✅ NOTIFICATION CREATED for provider:', provider_id);
        }
      });

      // Emit Real-time Notification
      if (req.io) {
        console.log('📡 EMITTING SOCKET NOTIFICATION to provider:', provider_id);
        req.io.emit('booking_notification', {
          providerId: provider_id,
          message: message,
          timestamp: new Date()
        });
      } else {
        console.warn('⚠️  Socket.io not available for notification');
      }

      res.status(201).json({
        message: 'Booking created successfully',
        booking: {
          id: bookingId,
          user_id,
          service_id,
          provider_id,
          date,
          time,
          address,
          notes,
          payment_method,
          status: 'pending'
        }
      });
    });
  });
});

// Update Booking Status (Generic) -> e.g. 'accepted', 'started', 'paid'
router.put('/:id/status', authMiddleware, restrictTo('provider', 'admin', 'user'), (req, res) => {
  const { status } = req.body;
  
  db.run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (['paid', 'completed'].includes(status)) {
      createInvoiceForBooking(req.params.id).catch((invoiceErr) => {
        console.error('Invoice generation error during status update:', invoiceErr);
      });
    }

    res.json({ message: 'Status updated successfully' });
  });
});

// Update Booking to Completed with Proof Image
router.put('/:id/complete', authMiddleware, restrictTo('provider', 'admin'), upload.single('proof_image'), async (req, res) => {
  const proof_image = req.file ? `https://smart-service2.onrender.com/uploads/${req.file.filename}` : null;
  const warrantyDays = 7;
  const expiryDate = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();

  db.run(
    `UPDATE bookings SET status = 'completed', proof_image = ?, warranty_expires = ? WHERE id = ?`,
    [proof_image, expiryDate, req.params.id],
    async function(err) {
      if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Database error' });
      }

      db.run(
        `INSERT OR REPLACE INTO warranties (booking_id, warranty_days, expiry_date, status) VALUES (?, ?, ?, ?)`,
        [req.params.id, warrantyDays, expiryDate, 'active'],
        async (warrantyErr) => {
          if (warrantyErr) {
            console.error('Warranty creation error:', warrantyErr);
          }

          try {
            await createInvoiceForBooking(req.params.id);
          } catch (invoiceErr) {
            console.error('Invoice generation error:', invoiceErr);
          }

          res.json({ message: 'Service marked as completed successfully', proof_image, warranty_expires: expiryDate });
        }
      );
    }
  );
});

// Request Warranty Revisit
router.post('/:id/warranty-revisit', authMiddleware, restrictTo('user'), (req, res) => {
    const bookingId = req.params.id;
    
    db.run(`UPDATE bookings SET warranty_revisit_requested = 1 WHERE id = ? AND user_id = ? AND datetime('now') <= warranty_expires`, [bookingId, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (this.changes === 0) {
            return res.status(400).json({ message: 'Cannot request free revisit. Either warranty expired or invalid booking.' });
        }
        res.json({ message: 'Warranty revisit requested successfully. The provider has been notified.' });
    });
});

// Get User Bookings
router.get('/my-bookings', authMiddleware, restrictTo('user'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as service_title, u.name as provider_name 
    FROM bookings b 
    LEFT JOIN users u ON b.provider_id = u.id 
    WHERE b.user_id = ? ORDER BY b.id DESC`;
    
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
        console.error('GET /my-bookings SQL Error:', err.message);
        return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    res.json(rows || []);
  });
});

// Get Provider Booking Requests
router.get('/requests', authMiddleware, restrictTo('provider'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as title, c.name as user_name, c.phone as user_phone, s.title AS service_title, s.price AS service_price
    FROM bookings b
    LEFT JOIN users u ON b.provider_id = u.id
    LEFT JOIN users c ON b.user_id = c.id
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.provider_id = ? ORDER BY b.id DESC`;
    
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
        console.error('GET /requests SQL Error:', err.message);
        return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    res.json(rows || []);
  });
});

// Get single booking for the logged-in user
router.get('/:id', authMiddleware, restrictTo('user'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as service_title, u.name as provider_name, u.lat as provider_lat, u.lng as provider_lng
    FROM bookings b
    LEFT JOIN users u ON b.provider_id = u.id
    WHERE b.id = ? AND b.user_id = ?`;

  db.get(sql, [req.params.id, req.user.id], (err, row) => {
    if (err) {
      console.error('GET /:id SQL Error:', err.message);
      return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(row);
  });
});

// Admin: Get all platform bookings
router.get('/all', authMiddleware, restrictTo('admin'), (req, res) => {
  const sql = `
    SELECT b.*, 
           'Professional ' || u.provider_category as service_title, 
           u.name as provider_name, 
           u.lat as provider_lat, 
           u.lng as provider_lng, 
           c.name as user_name
    FROM bookings b
    JOIN users u ON b.provider_id = u.id
    JOIN users c ON b.user_id = c.id
    ORDER BY b.id DESC`;
    
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows || []);
  });
});

// Admin: Export platform data to CSV
router.get('/export', authMiddleware, restrictTo('admin'), (req, res) => {
  const sql = `
    SELECT b.id as Booking_ID, 
           b.date as Date,
           b.time as Time,
           b.status as Status,
           b.payment_method as Payment_Method,
           b.address as Address,
           u.name as Provider_Name, 
           c.name as Customer_Name
    FROM bookings b
    JOIN users u ON b.provider_id = u.id
    JOIN users c ON b.user_id = c.id
    ORDER BY b.id DESC`;
    
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    
    if (!rows || rows.length === 0) {
        return res.status(404).send("No records found.");
    }

    // Convert JSON array of objects to CSV string physically
    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(row => {
        return Object.values(row).map(val => {
            // Escape commas and quotes
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
    });
    
    const csvData = [headers, ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="smartservice-data.csv"');
    res.send(csvData);
  });
});

module.exports = router;
