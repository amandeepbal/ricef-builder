const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const vid = req.query.version_id || 1;
  const rows = db.prepare('SELECT * FROM ricef_types WHERE version_id = ? ORDER BY sort_order').all(vid);
  rows.forEach(r => { r.is_active = !!r.is_active; });
  res.json(rows);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, version_id } = req.body;
  const result = db.prepare(
    `INSERT INTO ricef_types (version_id, code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(version_id || 1, code, label, full_label, seq_from, seq_to, sheet_type_code || 'RICEF', sort_order || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, is_active } = req.body;
  db.prepare(
    `UPDATE ricef_types SET code=?, label=?, full_label=?, seq_from=?, seq_to=?,
     sheet_type_code=?, sort_order=?, is_active=? WHERE id=?`
  ).run(code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, is_active, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE ricef_types SET is_active = 1 - is_active WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
