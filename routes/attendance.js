const express = require('express');
const router = express.Router();
const db = require('../db');

// Mark attendance
router.post('/', async (req, res) => {
  const { student_id, subject_id, date, status } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?,?,?,?)',
      [student_id, subject_id, date, status]
    );
    res.json({ message: 'Attendance marked', attendance_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get attendance by student
router.get('/student/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT a.*, s.subject_name FROM attendance a JOIN subjects s ON a.subject_id = s.subject_id WHERE a.student_id = ?',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
