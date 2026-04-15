const db = require('../database');

const getWarrantyByBookingId = (req, res) => {
  const bookingId = Number(req.params.bookingId);
  if (!bookingId) {
    return res.status(400).json({ message: 'Invalid booking ID' });
  }

  db.get(`SELECT * FROM warranties WHERE booking_id = ?`, [bookingId], (err, warranty) => {
    if (err) {
      console.error('getWarrantyByBookingId error:', err);
      return res.status(500).json({ message: 'Unable to retrieve warranty' });
    }

    if (!warranty) {
      return res.status(404).json({ message: 'Warranty not found' });
    }

    if (req.user.role === 'user') {
      db.get(`SELECT user_id FROM bookings WHERE id = ?`, [bookingId], (bookingErr, booking) => {
        if (bookingErr) {
          console.error('getWarrantyByBookingId booking lookup error:', bookingErr);
          return res.status(500).json({ message: 'Unable to verify permission' });
        }

        if (!booking || booking.user_id !== req.user.id) {
          return res.status(403).json({ message: 'You do not have permission to view this warranty' });
        }

        res.json(warranty);
      });
      return;
    }

    res.json(warranty);
  });
};

module.exports = { getWarrantyByBookingId };
