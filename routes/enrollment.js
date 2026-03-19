const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all subjects for student's programme with pairing info
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

    // Add pairing info - find T/P pairs for MDC and SEC
    const enriched = subjects.map(sub => {
      let pair_code = null;
      let pair_type = null;

      if (['MDC','SEC'].includes(sub.category) && sub.credits <= 2) {
        const code = sub.subject_code.trim();
        const lastChar = code.slice(-1).toUpperCase();
        if (lastChar === 'T') {
          // Find the P pair
          const pCode = code.slice(0, -1) + 'P';
          const pPair = subjects.find(s2 => s2.subject_code.trim() === pCode && s2.category === sub.category);
          if (pPair) { pair_code = pCode; pair_type = 'THEORY'; }
        } else if (lastChar === 'P') {
          // Find the T pair
          const tCode = code.slice(0, -1) + 'T';
          const tPair = subjects.find(s2 => s2.subject_code.trim() === tCode && s2.category === sub.category);
          if (tPair) { pair_code = tCode; pair_type = 'PRACTICAL'; }
        }
      }
      return { ...sub, pair_code, pair_type };
    });

    res.json(enriched);
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

// Validate and submit enrollment
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

    const accepted = enrollments.filter(e => e.status === 'ACCEPTED');

    // Get full subject details for validation
    const subjectIds = accepted.map(e => e.subject_id);
    let subjectDetails = [];
    if (subjectIds.length > 0) {
      const [details] = await db.query(
        `SELECT s.*, d.discipline_id, d.discipline_name 
         FROM subjects s 
         LEFT JOIN disciplines d ON s.discipline_id = d.discipline_id 
         WHERE s.subject_id IN (?)`,
        [subjectIds]
      );
      subjectDetails = details;
    }

    const errors = [];

    // Get MAJOR discipline IDs (for conflict check)
    const majorDisciplines = subjectDetails
      .filter(s => s.category === 'MAJOR')
      .map(s => s.discipline_id)
      .filter(Boolean);

    // Group accepted by category
    const byCategory = {};
    subjectDetails.forEach(s => {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    });

    // ── RULE 1: MIC → exactly 1, discipline conflict applies ──
    const micSubjects = byCategory['MIC'] || [];
    if (micSubjects.length === 0) {
      errors.push('❌ You must select exactly 1 MIC (Minor/Vocational) subject.');
    } else if (micSubjects.length > 1) {
      errors.push(`❌ You can select only 1 MIC subject. You selected ${micSubjects.length}.`);
    } else {
      // Check discipline conflict
      if (majorDisciplines.includes(micSubjects[0].discipline_id)) {
        errors.push(`❌ MIC conflict: "${micSubjects[0].subject_name}" belongs to your MAJOR discipline. Choose a different discipline.`);
      }
    }

    // ── RULE 2: VAC → exactly 1, no discipline conflict ──
    const vacSubjects = byCategory['VAC'] || [];
    if (vacSubjects.length === 0) {
      errors.push('❌ You must select exactly 1 VAC (Value Added) subject.');
    } else if (vacSubjects.length > 1) {
      errors.push(`❌ You can select only 1 VAC subject. You selected ${vacSubjects.length}.`);
    }

    // ── RULE 3: AEC → exactly 1, no discipline conflict ──
    const aecSubjects = byCategory['AEC'] || [];
    if (aecSubjects.length > 1) {
      errors.push(`❌ You can select only 1 AEC subject. You selected ${aecSubjects.length}.`);
    }

    // ── RULE 4: MDC → 3 credits = 1 subject / 2 credits = T+P pair, discipline conflict applies ──
    const mdcSubjects = byCategory['MDC'] || [];
    if (mdcSubjects.length === 0) {
      errors.push('❌ You must select at least 1 MDC (Multidisciplinary) subject.');
    } else {
      // Check discipline conflict for MDC
      mdcSubjects.forEach(s => {
        if (majorDisciplines.includes(s.discipline_id)) {
          errors.push(`❌ MDC conflict: "${s.subject_name}" belongs to your MAJOR discipline. Choose a different discipline.`);
        }
      });

      // Group MDC by base code (without last T/P)
      const mdcGroups = {};
      mdcSubjects.forEach(s => {
        const code = s.subject_code.trim();
        const lastChar = code.slice(-1).toUpperCase();
        const isTP = ['T','P'].includes(lastChar);
        const baseCode = isTP ? code.slice(0,-1) : code;
        if (!mdcGroups[baseCode]) mdcGroups[baseCode] = [];
        mdcGroups[baseCode].push(s);
      });

      // Validate MDC selections
      const mdcBaseCount = Object.keys(mdcGroups).length;
      if (mdcBaseCount > 1) {
        errors.push(`❌ You can only select MDC subjects from ONE discipline group. You selected from ${mdcBaseCount} groups.`);
      }

      Object.entries(mdcGroups).forEach(([baseCode, group]) => {
        const has3Credit = group.some(s => s.credits >= 3);
        const hasT = group.some(s => s.subject_code.trim().toUpperCase().endsWith('T'));
        const hasP = group.some(s => s.subject_code.trim().toUpperCase().endsWith('P'));
        const hasTwoCreditT = group.some(s => s.credits <= 2 && s.subject_code.trim().toUpperCase().endsWith('T'));
        const hasTwoCreditP = group.some(s => s.credits <= 2 && s.subject_code.trim().toUpperCase().endsWith('P'));

        if (has3Credit && group.length > 1) {
          errors.push(`❌ MDC: 3-credit subject "${group[0].subject_name}" must be selected alone.`);
        }
        if (hasTwoCreditT && !hasTwoCreditP) {
          errors.push(`❌ MDC: You selected Theory (T) for "${group[0].subject_name}" but must also select the Practical (P) companion.`);
        }
        if (hasTwoCreditP && !hasTwoCreditT) {
          errors.push(`❌ MDC: You selected Practical (P) for "${group[0].subject_name}" but must also select the Theory (T) companion.`);
        }
      });
    }

    // ── RULE 5: SEC → same T+P pairing rule as MDC, NO discipline conflict ──
    const secSubjects = byCategory['SEC'] || [];
    if (secSubjects.length > 0) {
      const secGroups = {};
      secSubjects.forEach(s => {
        const code = s.subject_code.trim();
        const lastChar = code.slice(-1).toUpperCase();
        const isTP = ['T','P'].includes(lastChar);
        const baseCode = isTP ? code.slice(0,-1) : code;
        if (!secGroups[baseCode]) secGroups[baseCode] = [];
        secGroups[baseCode].push(s);
      });

      const secBaseCount = Object.keys(secGroups).length;
      if (secBaseCount > 1) {
        errors.push(`❌ You can only select SEC subjects from ONE group. You selected from ${secBaseCount} groups.`);
      }

      Object.entries(secGroups).forEach(([baseCode, group]) => {
        const has3Credit = group.some(s => s.credits >= 3);
        const hasTwoCreditT = group.some(s => s.credits <= 2 && s.subject_code.trim().toUpperCase().endsWith('T'));
        const hasTwoCreditP = group.some(s => s.credits <= 2 && s.subject_code.trim().toUpperCase().endsWith('P'));

        if (has3Credit && group.length > 1) {
          errors.push(`❌ SEC: 3-credit subject must be selected alone.`);
        }
        if (hasTwoCreditT && !hasTwoCreditP) {
          errors.push(`❌ SEC: You selected Theory (T) but must also select the Practical (P) companion.`);
        }
        if (hasTwoCreditP && !hasTwoCreditT) {
          errors.push(`❌ SEC: You selected Practical (P) but must also select the Theory (T) companion.`);
        }
      });
    }

    // Return errors if any
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('\n'), errors });
    }

    // All validations passed - save enrollment
    await db.query(
      'DELETE FROM student_subject_enrollment WHERE student_id = ? AND status = ?',
      [req.params.student_id, 'PENDING']
    );

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
