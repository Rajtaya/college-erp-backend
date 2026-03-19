const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Student login
router.post('/student/login', async (req, res) => {
  const { roll_no, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM students WHERE roll_no = ?', [roll_no]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: rows[0].student_id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, student: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher login
router.post('/teacher/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: rows[0].teacher_id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, teacher: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
