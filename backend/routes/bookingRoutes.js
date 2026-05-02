const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const db = require('../database');
const upload = require('../multerConfig');
const { createInvoiceForBooking } = require('../controllers/invoiceController');
const { sendInvoiceEmail } = require('../services/emailService');
const { sendInvoiceSms } = require('../services/smsService');
const router = express.Router();

// ─── User: Create a Booking ───────────────────────────────────────────────────
// FIX: Services on this platform are VIRTUAL — dynamically generated from the
// users (providers) table. The /api/services response sets id = provider_id.
// There are NO rows in the services table to validate against, so we validate
// the provider_id against the users table instead.
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

  const normalizedServiceId = Number(service_id);
  const normalizedProviderId = Number(provider_id);

  if (Number.isNaN(normalizedServiceId) || Number.isNaN(normalizedProviderId)) {
    console.error('❌ BOOKING VALIDATION FAILED - Invalid IDs:', { service_id, provider_id });
    return res.status(400).json({ message: 'service_id and provider_id must be valid numbers' });
  }

  console.log('✅ ID validation passed — service_id:', normalizedServiceId, 'provider_id:', normalizedProviderId);

  // Validate provider exists in users table
  db.get(
    `SELECT id, name, provider_category FROM users WHERE id = ? AND role = 'provider'`,
    [normalizedProviderId],
    (err, providerRecord) => {
      if (err) {
        console.error('❌ DB ERROR verifying provider:', err.message);
        return res.status(500).json({ message: 'Database error verifying provider' });
      }

      if (!providerRecord) {
        console.error('❌ BOOKING FAILED - Provider not found:', normalizedProviderId);
        return res.status(400).json({ message: 'Invalid provider ID — provider not found' });
      }

      console.log('✅ Provider verified:', providerRecord.name, '(' + providerRecord.provider_category + ')');

      // service_id === provider_id in the virtual service model, validate they match
      if (normalizedServiceId !== normalizedProviderId) {
        console.error('❌ BOOKING FAILED - service_id/provider_id mismatch:', {
          service_id: normalizedServiceId,
          provider_id: normalizedProviderId
        });
        return res.status(400).json({ message: 'service_id must match provider_id (virtual services platform)' });
      }

      // Store service_id as NULL — no real services table row exists
      // NULL is allowed on FK columns in SQLite so this bypasses FK constraint
      const sql = `
        INSERT INTO bookings (user_id, service_id, provider_id, date, time, address, notes, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        user_id,
        null,                         // service_id = null (no real services table row)
        normalizedProviderId,
        date,
        time,
        address,
        notes || '',
        payment_method || 'cod'
      ];

      console.log('🔍 Inserting booking:', values);

      db.run(sql, values, function (err) {
        if (err) {
          console.error('❌ BOOKING INSERT FAILED:', err.message, err.code);

          if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(400).json({ message: 'Invalid user or provider ID (FK constraint)' });
          }
          if (err.message.includes('no such table')) {
            return res.status(500).json({ message: 'Database schema error — bookings table missing' });
          }
          return res.status(500).json({ message: 'Database error creating booking', error: err.message });
        }

        const bookingId = this.lastID;
        console.log('✅ BOOKING INSERTED - ID:', bookingId);

        // Verify saved and get user details for notification
        const verifySql = `
          SELECT b.*, u.name as user_name, u.email as user_email, u.phone as user_phone
          FROM bookings b
          JOIN users u ON b.user_id = u.id
          WHERE b.id = ?
        `;
        db.get(verifySql, [bookingId], async (verifyErr, booking) => {
          if (verifyErr || !booking) {
            console.error('❌ Booking verification failed');
            return res.status(500).json({ message: 'Booking verification failed after insert' });
          }

          console.log('✅ Booking verified in DB:', booking.id);

          const serviceName = providerRecord.provider_category ? 
            providerRecord.provider_category.charAt(0).toUpperCase() + providerRecord.provider_category.slice(1) : 'Service';
          const amount = 500; // Expected amount example

          // ─── 1. Send Email Notification ───────────────────────────────────────
          if (booking.user_email) {
            try {
              await sendInvoiceEmail({
                to: booking.user_email,
                subject: 'Booking Confirmation - Smart Service',
                text: `Hello ${booking.user_name},\n\nYour booking is confirmed.\n\nService: ${serviceName}\nDate: ${date}\nTime: ${time}\nAmount: ₹${amount}\n\nThank you for choosing Smart Service!`
              });
              console.log('✅ Email sent successfully to:', booking.user_email);
            } catch (err) {
              console.error('⚠️ Failed to send email (Skipping safely):', err.message);
            }
          }

          // ─── 2. Send SMS Notification ─────────────────────────────────────────
          if (booking.user_phone) {
            try {
              await sendInvoiceSms(
                booking.user_phone,
                `Your booking is confirmed. Service: ${serviceName}, Date: ${date}, Amount: ₹${amount}`
              );
              console.log('✅ SMS sent successfully to:', booking.user_phone);
            } catch (err) {
              console.error('⚠️ Failed to send SMS (Skipping safely):', err.message);
            }
          }

          // Notify provider
          const notifMsg = `New booking from user #${user_id} on ${date} at ${time}.`;
          db.run(
            `INSERT INTO notifications (user_id, content) VALUES (?, ?)`,
            [normalizedProviderId, notifMsg],
            (notifyErr) => {
              if (notifyErr) console.error('❌ Notification error:', notifyErr.message);
            }
          );

          // Emit socket notification
          if (req.io) {
            req.io.emit('booking_notification', {
              providerId: normalizedProviderId,
              message: notifMsg,
              timestamp: new Date()
            });
          }

          res.status(201).json({
            message: 'Booking created successfully',
            bookingId,
            booking: {
              id: bookingId,
              user_id,
              service_id: normalizedServiceId,
              provider_id: normalizedProviderId,
              date,
              time,
              address,
              notes: notes || '',
              payment_method: payment_method || 'cod',
              status: 'pending'
            }
          });
        });
      });
    }
  );
});

// ─── Update Booking Status ────────────────────────────────────────────────────
router.put('/:id/status', authMiddleware, restrictTo('provider', 'admin', 'user'), (req, res) => {
  const { status } = req.body;

  db.run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (['paid', 'completed'].includes(status)) {
      createInvoiceForBooking(req.params.id).catch((invoiceErr) => {
        console.error('Invoice generation error during status update:', invoiceErr);
      });
    }

    res.json({ message: 'Status updated successfully' });
  });
});

// ─── Complete Booking with Proof Image ───────────────────────────────────────
router.put('/:id/complete', authMiddleware, restrictTo('provider', 'admin'), upload.single('proof_image'), async (req, res) => {
  const proof_image = req.file ? `https://smart-service2.onrender.com/uploads/${req.file.filename}` : null;
  const warrantyDays = 7;
  const expiryDate = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();

  db.run(
    `UPDATE bookings SET status = 'completed', proof_image = ?, warranty_expires = ? WHERE id = ?`,
    [proof_image, expiryDate, req.params.id],
    async function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      db.run(
        `INSERT OR REPLACE INTO warranties (booking_id, warranty_days, expiry_date, status) VALUES (?, ?, ?, ?)`,
        [req.params.id, warrantyDays, expiryDate, 'active'],
        async (warrantyErr) => {
          if (warrantyErr) console.error('Warranty creation error:', warrantyErr);

          try {
            await createInvoiceForBooking(req.params.id);
          } catch (invoiceErr) {
            console.error('Invoice generation error:', invoiceErr);
          }

          res.json({
            message: 'Service marked as completed successfully',
            proof_image,
            warranty_expires: expiryDate
          });
        }
      );
    }
  );
});

// ─── Request Warranty Revisit ─────────────────────────────────────────────────
router.post('/:id/warranty-revisit', authMiddleware, restrictTo('user'), (req, res) => {
  const bookingId = req.params.id;

  db.run(
    `UPDATE bookings SET warranty_revisit_requested = 1 WHERE id = ? AND user_id = ? AND datetime('now') <= warranty_expires`,
    [bookingId, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (this.changes === 0) {
        return res.status(400).json({ message: 'Cannot request free revisit. Warranty expired or invalid booking.' });
      }
      res.json({ message: 'Warranty revisit requested successfully. The provider has been notified.' });
    }
  );
});

// ─── Get User Bookings ────────────────────────────────────────────────────────
router.get('/my-bookings', authMiddleware, restrictTo('user'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as service_title, u.name as provider_name
    FROM bookings b
    LEFT JOIN users u ON b.provider_id = u.id
    WHERE b.user_id = ? ORDER BY b.id DESC
  `;

  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error('GET /my-bookings SQL Error:', err.message);
      return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    res.json(rows || []);
  });
});

// ─── Get Provider Booking Requests ───────────────────────────────────────────
router.get('/requests', authMiddleware, restrictTo('provider'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as title, c.name as user_name, c.phone as user_phone,
           u.provider_category AS service_title, 400 AS service_price
    FROM bookings b
    LEFT JOIN users u ON b.provider_id = u.id
    LEFT JOIN users c ON b.user_id = c.id
    WHERE b.provider_id = ? ORDER BY b.id DESC
  `;

  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error('GET /requests SQL Error:', err.message);
      return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    res.json(rows || []);
  });
});

// ─── Admin: Get All Bookings ── MUST be before /:id ──────────────────────────
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
    ORDER BY b.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows || []);
  });
});

// ─── Admin: Export Bookings as CSV ── MUST be before /:id ────────────────────
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
    ORDER BY b.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (!rows || rows.length === 0) {
      return res.status(404).send('No records found.');
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(row =>
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvData = [headers, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="smartservice-data.csv"');
    res.send(csvData);
  });
});

// ─── Get Single Booking ── MUST be after /all and /export ────────────────────
router.get('/:id', authMiddleware, restrictTo('user'), (req, res) => {
  const sql = `
    SELECT b.*, 'Professional ' || u.provider_category as service_title,
           u.name as provider_name, u.lat as provider_lat, u.lng as provider_lng
    FROM bookings b
    LEFT JOIN users u ON b.provider_id = u.id
    WHERE b.id = ? AND b.user_id = ?
  `;

  db.get(sql, [req.params.id, req.user.id], (err, row) => {
    if (err) {
      console.error('GET /:id SQL Error:', err.message);
      return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    if (!row) return res.status(404).json({ message: 'Booking not found' });
    res.json(row);
  });
});

module.exports = router;
