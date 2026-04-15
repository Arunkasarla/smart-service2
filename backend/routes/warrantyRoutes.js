const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { getWarrantyByBookingId } = require('../controllers/warrantyController');

const router = express.Router();
router.get('/:bookingId', authMiddleware, restrictTo('user', 'admin'), getWarrantyByBookingId);

module.exports = router;
