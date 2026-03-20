const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: 'Admin not found' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: rows[0].admin_id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, admin: { admin_id: rows[0].admin_id, name: rows[0].name, email: rows[0].email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/students', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT student_id, roll_no, name, email, phone, course, semester, year FROM students');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/students/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM students WHERE student_id = ?', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teachers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT teacher_id, name, email, phone, department FROM teachers');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/teachers', async (req, res) => {
  const { name, email, phone, department, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO teachers (name, email, phone, department, password) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, department, hashed]
    );
    res.json({ message: 'Teacher added', teacher_id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM teachers WHERE teacher_id = ?', [req.params.id]);
    res.json({ message: 'Teacher deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/subjects/all', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, l.level_name, p.programme_name 
       FROM subjects s
       LEFT JOIN levels l ON s.level_id = l.level_id
       LEFT JOIN programmes p ON s.programme_id = p.programme_id
       ORDER BY l.level_name, p.programme_name, s.semester`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/subjects', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subjects');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subjects', async (req, res) => {
  const { subject_code, subject_name, category, semester, credits, teacher_id } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO subjects (subject_code, subject_name, category, semester, credits, teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
      [subject_code, subject_name, category, semester, credits, teacher_id || null]
    );
    res.json({ message: 'Subject added', subject_id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/subjects/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM subjects WHERE subject_id = ?', [req.params.id]);
    res.json({ message: 'Subject deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attendance', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, s.name as student_name, sub.subject_name 
       FROM attendance a 
       JOIN students s ON a.student_id = s.student_id 
       JOIN subjects sub ON a.subject_id = sub.subject_id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fees', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT f.*, s.name as student_name, s.roll_no 
       FROM fees f JOIN students s ON f.student_id = s.student_id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/marks', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, s.name as student_name, sub.subject_name 
       FROM marks m 
       JOIN students s ON m.student_id = s.student_id 
       JOIN subjects sub ON m.subject_id = sub.subject_id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/marks/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM marks WHERE mark_id = ?', [req.params.id]);
    res.json({ message: 'Mark deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/enrollment/summary', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        st.student_id, st.roll_no, st.name as student_name,
        p.programme_name, l.level_name,
        st.semester,
        COUNT(e.enrollment_id) as total_enrolled,
        SUM(CASE WHEN e.status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN e.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN e.status = 'PENDING'  THEN 1 ELSE 0 END) as pending
       FROM students st
       LEFT JOIN student_subject_enrollment e ON st.student_id = e.student_id
       LEFT JOIN programmes p ON st.programme_id = p.programme_id
       LEFT JOIN levels l ON st.level_id = l.level_id
       GROUP BY st.student_id
       ORDER BY st.roll_no`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/enrollment/detail/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.enrollment_id, e.status, e.is_major, e.remarks, e.enrolled_at,
              s.subject_code, s.subject_name, s.category, s.credits, s.semester,
              d.discipline_name
       FROM student_subject_enrollment e
       JOIN subjects s ON e.subject_id = s.subject_id
       LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id
       WHERE e.student_id = ?
       ORDER BY s.category, s.subject_code`,
      [req.params.student_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/enrollment/reset/:student_id', async (req, res) => {
  try {
    await db.query('DELETE FROM student_subject_enrollment WHERE student_id = ?', [req.params.student_id]);
    res.json({ message: 'Enrollment reset successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
