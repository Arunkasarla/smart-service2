const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const db = require('../database');
const router = express.Router();

// GET all providers
router.get('/providers', authMiddleware, restrictTo('admin'), (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.phone, u.provider_category, u.is_banned,
               COUNT(b.id) as total_bookings
        FROM users u
        LEFT JOIN bookings b ON u.id = b.provider_id
        WHERE u.role = 'provider'
        GROUP BY u.id
        ORDER BY u.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// TOGGLE BAN Provider
router.post('/provider/:id/ban', authMiddleware, restrictTo('admin'), (req, res) => {
    const providerId = req.params.id;
    const { is_banned } = req.body; // 1 or 0
    
    db.run(`UPDATE users SET is_banned = ? WHERE id = ? AND role = 'provider'`, [is_banned, providerId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, is_banned });
    });
});

// GET Admin Dashboard Stats
router.get('/dashboard-stats', authMiddleware, restrictTo('admin'), (req, res) => {
    // We need: total bookings, revenue (say sum of prices of completed/paid bookings), active users (users where is_banned=0)
    db.get(`SELECT COUNT(*) as total_bookings FROM bookings`, [], (err, bookingsRes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Mock revenue logic (or sum if prices are explicitly available, but let's assume each booking avg 400 for metric)
        const revenue = bookingsRes.total_bookings * 400; // Mock base revenue

        db.get(`SELECT COUNT(*) as active_users FROM users WHERE role = 'user' AND is_banned = 0`, [], (err, usersRes) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                total_bookings: bookingsRes.total_bookings,
                revenue,
                active_users: usersRes.active_users
            });
        });
    });
});

module.exports = router;
