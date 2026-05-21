const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const configs = db.prepare('SELECT * FROM blended_rate_configs ORDER BY id').all();
  for (const config of configs) {
    config.effort_by_complexity = db.prepare(
      'SELECT * FROM blended_effort_by_complexity WHERE config_id = ? ORDER BY complexity'
    ).all(config.id);

    config.delivery_levels = db.prepare(
      'SELECT * FROM blended_delivery_levels WHERE config_id = ? ORDER BY level_number'
    ).all(config.id);

    for (const level of config.delivery_levels) {
      level.rates = db.prepare(
        'SELECT * FROM blended_rates WHERE level_id = ? ORDER BY currency'
      ).all(level.id);
    }
  }
  res.json(configs);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM blended_rate_configs WHERE id = ?').get(req.params.id);
  if (!config) return res.status(404).json({ error: 'Not found' });

  config.effort_by_complexity = db.prepare(
    'SELECT * FROM blended_effort_by_complexity WHERE config_id = ? ORDER BY complexity'
  ).all(config.id);

  config.delivery_levels = db.prepare(
    'SELECT * FROM blended_delivery_levels WHERE config_id = ? ORDER BY level_number'
  ).all(config.id);

  for (const level of config.delivery_levels) {
    level.rates = db.prepare(
      'SELECT * FROM blended_rates WHERE level_id = ? ORDER BY currency'
    ).all(level.id);
  }
  res.json(config);
});

function requireFiniteNumber(val, field) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) throw Object.assign(new Error(field + ' must be a valid number'), { status: 400 });
  return n;
}

router.put('/:configId/effort-by-complexity', (req, res, next) => {
  try {
    const db = getDb();
    const { items } = req.body;
    const update = db.prepare(
      'UPDATE blended_effort_by_complexity SET multiplier = ? WHERE config_id = ? AND complexity = ?'
    );
    const txn = db.transaction(() => {
      for (const item of items) {
        const m = requireFiniteNumber(item.multiplier, 'multiplier');
        update.run(m, req.params.configId, item.complexity);
      }
    });
    txn();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/:configId/levels/:levelId/rates', (req, res, next) => {
  try {
    const db = getDb();
    const { rates } = req.body;
    const update = db.prepare(
      `UPDATE blended_rates SET billable_rate=?, effort_multiplier=?, blended_cost=?, margin_pct=?
       WHERE level_id=? AND currency=?`
    );
    const txn = db.transaction(() => {
      for (const r of rates) {
        update.run(
          requireFiniteNumber(r.billable_rate, 'billable_rate'),
          requireFiniteNumber(r.effort_multiplier, 'effort_multiplier'),
          requireFiniteNumber(r.blended_cost, 'blended_cost'),
          requireFiniteNumber(r.margin_pct, 'margin_pct'),
          req.params.levelId, r.currency
        );
      }
    });
    txn();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
