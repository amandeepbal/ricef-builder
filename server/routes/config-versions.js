const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM config_versions ORDER BY valid_from DESC').all());
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const ver = db.prepare('SELECT * FROM config_versions WHERE id = ?').get(req.params.id);
  if (!ver) return res.status(404).json({ error: 'Version not found' });
  res.json(ver);
});

function checkDateOverlap(db, validFrom, validTo, excludeId) {
  const existing = db.prepare(
    'SELECT id, name, valid_from, valid_to FROM config_versions WHERE is_active = 1' +
    (excludeId ? ' AND id != ?' : '')
  ).all(...(excludeId ? [excludeId] : []));

  for (const v of existing) {
    const vFrom = v.valid_from;
    const vTo = v.valid_to || '9999-12-31';
    const newTo = validTo || '9999-12-31';
    if (validFrom <= vTo && newTo >= vFrom) {
      return v;
    }
  }
  return null;
}

router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, valid_from, valid_to } = req.body;
  if (!name || !valid_from) return res.status(400).json({ error: 'name and valid_from are required' });

  const overlap = checkDateOverlap(db, valid_from, valid_to);
  if (overlap) {
    return res.status(409).json({
      error: 'Date range overlaps with version "' + overlap.name + '" (' + overlap.valid_from + ' — ' + (overlap.valid_to || 'open') + ')'
    });
  }

  const r = db.prepare(
    'INSERT INTO config_versions (name, description, valid_from, valid_to) VALUES (?,?,?,?)'
  ).run(name, description || null, valid_from, valid_to || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description, valid_from, valid_to, is_active } = req.body;

  if (valid_from) {
    const overlap = checkDateOverlap(db, valid_from, valid_to, Number(req.params.id));
    if (overlap) {
      return res.status(409).json({
        error: 'Date range overlaps with version "' + overlap.name + '" (' + overlap.valid_from + ' — ' + (overlap.valid_to || 'open') + ')'
      });
    }
  }

  db.prepare(
    'UPDATE config_versions SET name=?, description=?, valid_from=?, valid_to=?, is_active=? WHERE id=?'
  ).run(name, description, valid_from, valid_to || null, is_active != null ? is_active : 1, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  if (Number(req.params.id) === 1) return res.status(400).json({ error: 'Cannot delete the default version' });
  db.prepare('UPDATE config_versions SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/clone', (req, res) => {
  const db = getDb();
  const srcId = Number(req.params.id);
  const src = db.prepare('SELECT * FROM config_versions WHERE id = ?').get(srcId);
  if (!src) return res.status(404).json({ error: 'Source version not found' });

  const { name, valid_from, valid_to } = req.body;
  if (!name || !valid_from) return res.status(400).json({ error: 'name and valid_from are required' });

  const overlap = checkDateOverlap(db, valid_from, valid_to);
  if (overlap) {
    return res.status(409).json({
      error: 'Date range overlaps with version "' + overlap.name + '" (' + overlap.valid_from + ' — ' + (overlap.valid_to || 'open') + ')'
    });
  }

  const clone = db.transaction(() => {
    const r = db.prepare(
      'INSERT INTO config_versions (name, description, valid_from, valid_to) VALUES (?,?,?,?)'
    ).run(name, 'Cloned from ' + src.name, valid_from, valid_to || null);
    const newId = r.lastInsertRowid;

    const copySimple = (table) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all()
        .map(c => c.name)
        .filter(c => c !== 'id' && c !== 'version_id');
      const colList = cols.join(', ');
      db.prepare(
        `INSERT INTO ${table} (version_id, ${colList}) SELECT ?, ${colList} FROM ${table} WHERE version_id = ?`
      ).run(newId, srcId);
    };

    // Simple tables (no child rows)
    copySimple('ricef_types');
    copySimple('estimation_grid');
    copySimple('sheet_column_config');

    // Blended rates: configs → levels → rates + effort_by_complexity
    const srcConfigs = db.prepare('SELECT * FROM blended_rate_configs WHERE version_id = ?').all(srcId);
    for (const cfg of srcConfigs) {
      const cfgCols = ['team_prefix', 'team_label', 'is_active'];
      const newCfg = db.prepare(
        `INSERT INTO blended_rate_configs (version_id, ${cfgCols.join(',')}) VALUES (?,?,?,?)`
      ).run(newId, cfg.team_prefix, cfg.team_label, cfg.is_active);
      const newCfgId = newCfg.lastInsertRowid;

      // Effort by complexity
      const ebcs = db.prepare('SELECT * FROM blended_effort_by_complexity WHERE config_id = ?').all(cfg.id);
      for (const ebc of ebcs) {
        db.prepare('INSERT INTO blended_effort_by_complexity (config_id, complexity, multiplier) VALUES (?,?,?)')
          .run(newCfgId, ebc.complexity, ebc.multiplier);
      }

      // Delivery levels → rates
      const levels = db.prepare('SELECT * FROM blended_delivery_levels WHERE config_id = ?').all(cfg.id);
      for (const lvl of levels) {
        const newLvl = db.prepare(
          'INSERT INTO blended_delivery_levels (config_id, level_number, level_label) VALUES (?,?,?)'
        ).run(newCfgId, lvl.level_number, lvl.level_label);
        const newLvlId = newLvl.lastInsertRowid;

        const rates = db.prepare('SELECT * FROM blended_rates WHERE level_id = ?').all(lvl.id);
        for (const rate of rates) {
          db.prepare(
            'INSERT INTO blended_rates (level_id, currency, billable_rate, effort_multiplier, blended_cost, margin_pct) VALUES (?,?,?,?,?,?)'
          ).run(newLvlId, rate.currency, rate.billable_rate, rate.effort_multiplier, rate.blended_cost, rate.margin_pct);
        }
      }
    }

    // Complexity definitions → factors
    const srcDefs = db.prepare('SELECT * FROM complexity_definitions WHERE version_id = ?').all(srcId);
    for (const def of srcDefs) {
      const defCols = ['team', 'classification_group', 'subgroup',
        'func_very_low', 'func_low', 'func_medium', 'func_high', 'func_very_high',
        'tech_very_low', 'tech_low', 'tech_medium', 'tech_high', 'tech_very_high'];
      const vals = defCols.map(c => def[c]);
      const newDef = db.prepare(
        `INSERT INTO complexity_definitions (version_id, ${defCols.join(',')}) VALUES (?${',?'.repeat(defCols.length)})`
      ).run(newId, ...vals);
      const newDefId = newDef.lastInsertRowid;

      const factors = db.prepare('SELECT * FROM complexity_factors WHERE definition_id = ?').all(def.id);
      for (const f of factors) {
        db.prepare(
          `INSERT INTO complexity_factors (definition_id, factor_name, value_very_low, value_low, value_medium, value_high, value_very_high, sort_order)
           VALUES (?,?,?,?,?,?,?,?)`
        ).run(newDefId, f.factor_name, f.value_very_low, f.value_low, f.value_medium, f.value_high, f.value_very_high, f.sort_order);
      }
    }

    // Dropdown categories → values
    const srcCats = db.prepare('SELECT * FROM dropdown_categories WHERE version_id = ?').all(srcId);
    for (const cat of srcCats) {
      const newCat = db.prepare(
        'INSERT INTO dropdown_categories (version_id, code, label, is_system) VALUES (?,?,?,?)'
      ).run(newId, cat.code, cat.label, cat.is_system);
      const newCatId = newCat.lastInsertRowid;

      const vals = db.prepare('SELECT * FROM dropdown_values WHERE category_id = ?').all(cat.id);
      for (const v of vals) {
        db.prepare(
          'INSERT INTO dropdown_values (category_id, value, display_label, is_separator, sort_order, is_active) VALUES (?,?,?,?,?,?)'
        ).run(newCatId, v.value, v.display_label, v.is_separator, v.sort_order, v.is_active);
      }
    }

    return newId;
  });

  const newId = clone();
  res.status(201).json({ id: newId });
});

// Resolve version for a given date
router.get('/resolve/:date', (req, res) => {
  const db = getDb();
  const d = req.params.date;
  const ver = db.prepare(
    `SELECT * FROM config_versions WHERE is_active = 1 AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1`
  ).get(d, d);
  res.json(ver || null);
});

module.exports = router;
