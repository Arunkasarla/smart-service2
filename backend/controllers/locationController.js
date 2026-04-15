const db = require('../database');

const updateLocation = (req, res) => {
  const { lat, lng, location } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (typeof lat === 'undefined' || typeof lng === 'undefined') {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  const sql = `UPDATE users SET lat = ?, lng = ?, location = ? WHERE id = ?`;
  db.run(sql, [lat, lng, location || '', userId], function (err) {
    if (err) {
      console.error('updateLocation error:', err);
      return res.status(500).json({ message: 'Unable to update location' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Location updated successfully' });
  });
};

module.exports = { updateLocation };
