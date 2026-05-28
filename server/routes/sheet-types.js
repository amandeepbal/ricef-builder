const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM sheet_types WHERE is_active = 1 ORDER BY sort_order');
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:code/columns', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows } = await pool.query(
      'SELECT * FROM sheet_column_config WHERE sheet_type_code = $1 AND version_id = $2 ORDER BY sort_order',
      [req.params.code, vid]
    );
    rows.forEach(r => {
      r.is_visible = !!r.is_visible;
      r.is_editable = !!r.is_editable;
    });
    res.json(rows);
  } catch (e) { next(e); }
});

router.put('/:code/columns', async (req, res, next) => {
  try {
    const pool = getPool();
    const { columns } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const col of columns) {
        await client.query(
          `UPDATE sheet_column_config SET column_label=$1, is_visible=$2, is_editable=$3, sort_order=$4, width=$5
           WHERE sheet_type_code=$6 AND column_key=$7`,
          [col.column_label, col.is_visible, col.is_editable, col.sort_order, col.width,
            req.params.code, col.column_key]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
