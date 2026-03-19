const express = require('express');
const router = express.Router();
const db = require('../db');

// Get fees by student
router.get('/student/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM fees WHERE student_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add fee record
router.post('/', async (req, res) => {
  const { student_id, amount, fee_type, due_date } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO fees (student_id, amount, fee_type, due_date) VALUES (?,?,?,?)',
      [student_id, amount, fee_type, due_date]
    );
    res.json({ message: 'Fee record added', fee_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark fee as paid
router.put('/pay/:id', async (req, res) => {
  const transaction_ref = 'TXN' + Date.now();
  try {
    await db.query(
      'UPDATE fees SET status="PAID", paid_date=CURDATE(), transaction_ref=? WHERE fee_id = ?',
      [transaction_ref, req.params.id]
    );
    res.json({ message: 'Payment recorded', transaction_ref });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
