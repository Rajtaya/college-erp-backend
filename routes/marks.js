const express = require('express');
const router = express.Router();
const db = require('../db');

// Add marks
router.post('/', async (req, res) => {
  const { student_id, subject_id, exam_type, marks_obtained, max_marks, semester } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO marks (student_id, subject_id, exam_type, marks_obtained, max_marks, semester) VALUES (?, ?, ?, ?, ?, ?)',
      [student_id, subject_id, exam_type, marks_obtained, max_marks, semester]
    );
    res.json({ message: 'Marks added', mark_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get marks by student
router.get('/student/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT m.*, s.subject_name, s.category FROM marks m JOIN subjects s ON m.subject_id = s.subject_id WHERE m.student_id = ?',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
