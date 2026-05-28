const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows: defs } = await pool.query('SELECT * FROM complexity_definitions WHERE version_id = $1 ORDER BY team, classification_group', [vid]);
    for (const d of defs) {
      d.factors = (await pool.query(
        'SELECT * FROM complexity_factors WHERE definition_id = $1 ORDER BY sort_order',
        [d.id]
      )).rows;
    }
    res.json(defs);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM complexity_definitions WHERE id = $1', [req.params.id]);
    const def = rows[0];
    if (!def) return res.status(404).json({ error: 'Not found' });
    def.factors = (await pool.query(
      'SELECT * FROM complexity_factors WHERE definition_id = $1 ORDER BY sort_order',
      [def.id]
    )).rows;
    res.json(def);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(`
      UPDATE complexity_definitions SET team=$1, classification_group=$2, subgroup=$3,
        func_very_low=$4, func_low=$5, func_medium=$6, func_high=$7, func_very_high=$8,
        tech_very_low=$9, tech_low=$10, tech_medium=$11, tech_high=$12, tech_very_high=$13
      WHERE id=$14
    `, [b.team, b.classification_group, b.subgroup,
      b.func_very_low, b.func_low, b.func_medium, b.func_high, b.func_very_high,
      b.tech_very_low, b.tech_low, b.tech_medium, b.tech_high, b.tech_very_high,
      req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    const { rows } = await pool.query(`
      INSERT INTO complexity_definitions (version_id, team, classification_group, subgroup,
        func_very_low, func_low, func_medium, func_high, func_very_high,
        tech_very_low, tech_low, tech_medium, tech_high, tech_very_high)
      VALUES ($1,$2,$3,$4, $5,$6,$7,$8,$9, $10,$11,$12,$13,$14) RETURNING id
    `, [b.version_id || 1, b.team, b.classification_group, b.subgroup,
      b.func_very_low, b.func_low, b.func_medium, b.func_high, b.func_very_high,
      b.tech_very_low, b.tech_low, b.tech_medium, b.tech_high, b.tech_very_high]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM complexity_factors WHERE definition_id = $1', [req.params.id]);
    await pool.query('DELETE FROM complexity_definitions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
