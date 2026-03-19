const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all subjects
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subjects');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a subject
router.post('/', async (req, res) => {
  const { subject_code, subject_name, category, semester, credits, teacher_id } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO subjects (subject_code, subject_name, category, semester, credits, teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
      [subject_code, subject_name, category, semester, credits, teacher_id || null]
    );
    res.json({ message: 'Subject added', subject_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subject by id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subjects WHERE subject_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
