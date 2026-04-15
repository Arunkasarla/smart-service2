const express = require('express');
const { updateLocation } = require('../controllers/locationController');

const router = express.Router();
router.post('/update', updateLocation);

module.exports = router;
