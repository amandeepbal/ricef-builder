const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows } = await pool.query('SELECT * FROM dropdown_categories WHERE version_id = $1 ORDER BY id', [vid]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:code', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows } = await pool.query('SELECT * FROM dropdown_categories WHERE code = $1 AND version_id = $2', [req.params.code, vid]);
    const cat = rows[0];
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    cat.values = (await pool.query(
      'SELECT * FROM dropdown_values WHERE category_id = $1 ORDER BY sort_order',
      [cat.id]
    )).rows;
    cat.values.forEach(v => {
      v.is_active = !!v.is_active;
      v.is_separator = !!v.is_separator;
    });
    res.json(cat);
  } catch (e) { next(e); }
});

router.post('/:code/values', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows: catRows } = await pool.query('SELECT id FROM dropdown_categories WHERE code = $1', [req.params.code]);
    const cat = catRows[0];
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    let sortOrder;
    if (req.body.insert_after != null) {
      const after = parseInt(req.body.insert_after);
      await pool.query(
        'UPDATE dropdown_values SET sort_order = sort_order + 1 WHERE category_id = $1 AND sort_order > $2',
        [cat.id, after]
      );
      sortOrder = after + 1;
    } else if (req.body.sort_order != null) {
      sortOrder = parseInt(req.body.sort_order);
    } else {
      const { rows: maxRows } = await pool.query(
        'SELECT MAX(sort_order) AS mx FROM dropdown_values WHERE category_id = $1',
        [cat.id]
      );
      sortOrder = (maxRows[0].mx || 0) + 1;
    }

    const { rows } = await pool.query(
      `INSERT INTO dropdown_values (category_id, value, display_label, is_separator, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [cat.id, req.body.value, req.body.display_label || null,
        req.body.is_separator || 0, sortOrder]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.put('/:code/values/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { value, display_label, is_separator, sort_order, is_active } = req.body;
    await pool.query(
      `UPDATE dropdown_values SET value=$1, display_label=$2, is_separator=$3, sort_order=$4, is_active=$5
       WHERE id=$6`,
      [value, display_label, is_separator, sort_order, is_active, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:code/values/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM dropdown_values WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
