const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { updateLocation } = require('../controllers/locationController');

const router = express.Router();
router.post('/update', authMiddleware, updateLocation);

module.exports = router;
