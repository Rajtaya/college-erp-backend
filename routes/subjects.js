const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, l.level_name, p.programme_name, f.faculty_name, d.discipline_name
       FROM subjects s
       LEFT JOIN levels l ON s.level_id = l.level_id
       LEFT JOIN programmes p ON s.programme_id = p.programme_id
       LEFT JOIN faculties f ON s.faculty_id = f.faculty_id
       LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id
       ORDER BY l.level_name, f.faculty_name, p.programme_name, s.semester, s.category`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { subject_code, subject_name, category, semester, credits, internal_marks, teacher_id, level_id, programme_id, faculty_id, discipline_id, discipline_name, is_common } = req.body;
  try {
    let resolved_discipline_id = discipline_id || null;
    if (!resolved_discipline_id && discipline_name) {
      const [existing] = await db.query('SELECT discipline_id FROM disciplines WHERE LOWER(discipline_name) = LOWER(?)', [discipline_name.trim()]);
      if (existing.length) {
        resolved_discipline_id = existing[0].discipline_id;
      } else {
        const [result] = await db.query('INSERT INTO disciplines (discipline_name, faculty_id) VALUES (?, ?)', [discipline_name.trim(), faculty_id||null]);
        resolved_discipline_id = result.insertId;
      }
    }
    const isCommon = ['MDC','MIC','SEC','VAC','AEC'].includes(category);
    const [result] = await db.query(
      `INSERT INTO subjects (subject_code, subject_name, category, semester, credits, internal_marks, teacher_id, level_id, programme_id, faculty_id, discipline_id, is_common)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_code, subject_name, category, semester, credits, internal_marks||0, teacher_id||null, level_id||null, isCommon?null:(programme_id||null), faculty_id||null, resolved_discipline_id, isCommon?true:false]
    );
    res.json({ message: 'Subject added', subject_id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, l.level_name, p.programme_name, f.faculty_name, d.discipline_name
       FROM subjects s
       LEFT JOIN levels l ON s.level_id = l.level_id
       LEFT JOIN programmes p ON s.programme_id = p.programme_id
       LEFT JOIN faculties f ON s.faculty_id = f.faculty_id
       LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id
       WHERE s.subject_id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
