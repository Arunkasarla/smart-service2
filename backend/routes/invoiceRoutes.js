const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { getInvoiceByBookingId, getInvoiceDownload } = require('../controllers/invoiceController');

const router = express.Router();
router.get('/:bookingId', authMiddleware, restrictTo('user', 'admin'), getInvoiceByBookingId);
router.get('/:bookingId/download', authMiddleware, restrictTo('user', 'admin'), getInvoiceDownload);

module.exports = router;
