const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all subjects for student's programme
// MAJOR: programme specific, others: common for all UG
router.get('/subjects/:student_id', async (req, res) => {
  try {
    const [student] = await db.query('SELECT * FROM students WHERE student_id = ?', [req.params.student_id]);
    if (!student.length) return res.status(404).json({ error: 'Student not found' });
    const s = student[0];

    const [subjects] = await db.query(
      `SELECT s.*, 
        d.discipline_name, d.discipline_id,
        e.enrollment_id, e.status as enrollment_status, 
        e.is_major, e.remarks
       FROM subjects s
       LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id
       LEFT JOIN student_subject_enrollment e 
         ON s.subject_id = e.subject_id AND e.student_id = ?
       WHERE s.semester = ?
         AND (
           (s.category = 'MAJOR' AND s.programme_id = ?)
           OR
           (s.category != 'MAJOR' AND s.is_common = TRUE)
         )
       ORDER BY s.category, s.subject_code`,
      [req.params.student_id, s.semester, s.programme_id]
    );
    res.json(subjects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get enrollment status for student
router.get('/status/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, s.subject_code, s.subject_name, s.category,
              s.credits, s.internal_marks, s.end_term_marks, s.total_marks,
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

// Student submits enrollment with discipline conflict validation
router.post('/submit/:student_id', async (req, res) => {
  const { enrollments } = req.body;
  try {
    // Check if already submitted
    const [existing] = await db.query(
      'SELECT COUNT(*) as count FROM student_subject_enrollment WHERE student_id = ? AND status != ?',
      [req.params.student_id, 'PENDING']
    );
    if (existing[0].count > 0) {
      return res.status(400).json({ error: 'Already submitted. Contact admin to reset.' });
    }

    // Get accepted MAJOR subjects and their disciplines
    const acceptedMajors = enrollments.filter(e => e.status === 'ACCEPTED' && e.is_major);
    const majorSubjectIds = acceptedMajors.map(e => e.subject_id);

    // Get disciplines of major subjects
    let majorDisciplines = [];
    if (majorSubjectIds.length > 0) {
      const [majors] = await db.query(
        `SELECT DISTINCT d.discipline_id, d.discipline_name 
         FROM subjects s 
         JOIN disciplines d ON s.discipline_id = d.discipline_id
         WHERE s.subject_id IN (?)`,
        [majorSubjectIds]
      );
      majorDisciplines = majors.map(m => m.discipline_id);
    }

    // Validate: MDC/MIC subjects should not be from same discipline as Major
    const conflicts = [];
    for (const e of enrollments) {
      if (e.status === 'ACCEPTED' && ['MDC','MIC'].includes(e.category)) {
        const [subInfo] = await db.query(
          'SELECT s.subject_code, s.subject_name, d.discipline_name, d.discipline_id FROM subjects s LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id WHERE s.subject_id = ?',
          [e.subject_id]
        );
        if (subInfo.length && majorDisciplines.includes(subInfo[0].discipline_id)) {
          conflicts.push(`${subInfo[0].subject_code} - ${subInfo[0].subject_name} (${subInfo[0].discipline_name}) conflicts with your Major discipline`);
        }
      }
    }

    if (conflicts.length > 0) {
      return res.status(400).json({
        error: `Discipline conflict detected! You cannot select the same discipline as your Major in MDC/MIC:\n${conflicts.join('\n')}`
      });
    }

    // Delete existing pending
    await db.query('DELETE FROM student_subject_enrollment WHERE student_id = ? AND status = ?',
      [req.params.student_id, 'PENDING']);

    // Insert enrollments
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

// Admin - reset enrollment
router.delete('/admin/reset/:student_id', async (req, res) => {
  try {
    await db.query('DELETE FROM student_subject_enrollment WHERE student_id = ?', [req.params.student_id]);
    res.json({ message: 'Enrollment reset successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
