const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { rows: configs } = await pool.query('SELECT * FROM blended_rate_configs WHERE version_id = $1 ORDER BY id', [vid]);
    for (const config of configs) {
      config.effort_by_complexity = (await pool.query(
        'SELECT * FROM blended_effort_by_complexity WHERE config_id = $1 ORDER BY complexity',
        [config.id]
      )).rows;

      config.delivery_levels = (await pool.query(
        'SELECT * FROM blended_delivery_levels WHERE config_id = $1 ORDER BY level_number',
        [config.id]
      )).rows;

      for (const level of config.delivery_levels) {
        level.rates = (await pool.query(
          'SELECT * FROM blended_rates WHERE level_id = $1 ORDER BY currency',
          [level.id]
        )).rows;
      }
    }
    res.json(configs);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM blended_rate_configs WHERE id = $1', [req.params.id]);
    const config = rows[0];
    if (!config) return res.status(404).json({ error: 'Not found' });

    config.effort_by_complexity = (await pool.query(
      'SELECT * FROM blended_effort_by_complexity WHERE config_id = $1 ORDER BY complexity',
      [config.id]
    )).rows;

    config.delivery_levels = (await pool.query(
      'SELECT * FROM blended_delivery_levels WHERE config_id = $1 ORDER BY level_number',
      [config.id]
    )).rows;

    for (const level of config.delivery_levels) {
      level.rates = (await pool.query(
        'SELECT * FROM blended_rates WHERE level_id = $1 ORDER BY currency',
        [level.id]
      )).rows;
    }
    res.json(config);
  } catch (e) { next(e); }
});

function requireFiniteNumber(val, field) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) throw Object.assign(new Error(field + ' must be a valid number'), { status: 400 });
  return n;
}

router.put('/:configId/effort-by-complexity', async (req, res, next) => {
  try {
    const pool = getPool();
    const { items } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        const m = requireFiniteNumber(item.multiplier, 'multiplier');
        await client.query(
          'UPDATE blended_effort_by_complexity SET multiplier = $1 WHERE config_id = $2 AND complexity = $3',
          [m, req.params.configId, item.complexity]
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

router.put('/:configId/levels/:levelId/rates', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rates } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of rates) {
        await client.query(
          `UPDATE blended_rates SET billable_rate=$1, effort_multiplier=$2, blended_cost=$3, margin_pct=$4
           WHERE level_id=$5 AND currency=$6`,
          [
            requireFiniteNumber(r.billable_rate, 'billable_rate'),
            requireFiniteNumber(r.effort_multiplier, 'effort_multiplier'),
            requireFiniteNumber(r.blended_cost, 'blended_cost'),
            requireFiniteNumber(r.margin_pct, 'margin_pct'),
            req.params.levelId, r.currency
          ]
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
