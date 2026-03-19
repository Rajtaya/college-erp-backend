const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all programmes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, l.level_name FROM programmes p 
       JOIN levels l ON p.level_id = l.level_id 
       ORDER BY l.level_name, p.programme_name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get programmes by level
router.get('/level/:level_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM programmes WHERE level_id = ?', [req.params.level_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add programme
router.post('/', async (req, res) => {
  const { level_id, programme_name, duration_years } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO programmes (level_id, programme_name, duration_years) VALUES (?, ?, ?)',
      [level_id, programme_name, duration_years || 3]
    );
    res.json({ message: 'Programme added', programme_id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete programme
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM programmes WHERE programme_id = ?', [req.params.id]);
    res.json({ message: 'Programme deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
