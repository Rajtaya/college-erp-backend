const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all subjects for student's programme
router.get('/subjects/:student_id', async (req, res) => {
  try {
    const [student] = await db.query('SELECT * FROM students WHERE student_id = ?', [req.params.student_id]);
    if (!student.length) return res.status(404).json({ error: 'Student not found' });
    const s = student[0];
    const [subjects] = await db.query(
      `SELECT s.*, 
        e.enrollment_id, e.status as enrollment_status, 
        e.is_major, e.remarks
       FROM subjects s
       LEFT JOIN student_subject_enrollment e 
         ON s.subject_id = e.subject_id AND e.student_id = ?
       WHERE s.programme_id = ? AND s.semester = ?
       ORDER BY s.category, s.subject_code`,
      [req.params.student_id, s.programme_id, s.semester]
    );
    res.json(subjects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get enrollment status for student
router.get('/status/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, s.subject_code, s.subject_name, s.category,
              s.credits, s.internal_marks, s.end_term_marks, s.total_marks
       FROM student_subject_enrollment e
       JOIN subjects s ON e.subject_id = s.subject_id
       WHERE e.student_id = ?
       ORDER BY s.category, s.subject_code`,
      [req.params.student_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Student submits enrollment
router.post('/submit/:student_id', async (req, res) => {
  const { enrollments } = req.body;
  try {
    const [existing] = await db.query(
      'SELECT COUNT(*) as count FROM student_subject_enrollment WHERE student_id = ? AND status != ?',
      [req.params.student_id, 'PENDING']
    );
    if (existing[0].count > 0) {
      return res.status(400).json({ error: 'You have already submitted your enrollment. Contact admin to reset.' });
    }
    await db.query('DELETE FROM student_subject_enrollment WHERE student_id = ? AND status = ?',
      [req.params.student_id, 'PENDING']);
    for (const e of enrollments) {
      await db.query(
        `INSERT INTO student_subject_enrollment 
         (student_id, subject_id, status, is_major, remarks)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), is_major=VALUES(is_major), remarks=VALUES(remarks)`,
        [req.params.student_id, e.subject_id, e.status, e.is_major||false, e.remarks||'']
      );
    }
    res.json({ message: 'Enrollment submitted successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin - get enrollment summary
router.get('/admin/summary', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        st.student_id, st.roll_no, st.name as student_name,
        p.programme_name, l.level_name,
        COUNT(e.enrollment_id) as total_enrolled,
        SUM(CASE WHEN e.status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN e.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN e.status = 'PENDING' THEN 1 ELSE 0 END) as pending
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

// Admin - reset enrollment for a student
router.delete('/admin/reset/:student_id', async (req, res) => {
  try {
    await db.query('DELETE FROM student_subject_enrollment WHERE student_id = ?', [req.params.student_id]);
    res.json({ message: 'Enrollment reset successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
