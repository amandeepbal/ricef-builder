const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows } = await pool.query('SELECT * FROM ricef_types WHERE version_id = $1 ORDER BY sort_order', [vid]);
    rows.forEach(r => { r.is_active = !!r.is_active; });
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, version_id } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO ricef_types (version_id, code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [version_id || 1, code, label, full_label, seq_from, seq_to, sheet_type_code || 'RICEF', sort_order || 0]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, is_active } = req.body;
    await pool.query(
      `UPDATE ricef_types SET code=$1, label=$2, full_label=$3, seq_from=$4, seq_to=$5,
       sheet_type_code=$6, sort_order=$7, is_active=$8 WHERE id=$9`,
      [code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order, is_active, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('UPDATE ricef_types SET is_active = 1 - is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
