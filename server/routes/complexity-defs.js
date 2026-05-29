const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

const COMPLEXITY_COLS = {
  '1-Very Low': 'very_low',
  '2-Low': 'low',
  '3-Medium': 'medium',
  '4-High': 'high',
  '5-Very High': 'very_high'
};

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;

    const { rows: gridRows } = await pool.query(
      `SELECT frice, classification, complexity, total_func, total_tech
       FROM estimation_grid WHERE version_id = $1
       ORDER BY frice, classification, complexity`,
      [vid]
    );

    const grouped = {};
    for (const r of gridRows) {
      const key = r.frice + ' / ' + r.classification;
      if (!grouped[key]) {
        grouped[key] = {
          classification_group: r.frice,
          subgroup: r.classification,
          _classificationKey: key,
          func_very_low: 0, func_low: 0, func_medium: 0, func_high: 0, func_very_high: 0,
          tech_very_low: 0, tech_low: 0, tech_medium: 0, tech_high: 0, tech_very_high: 0,
          factors: []
        };
      }
      const suffix = COMPLEXITY_COLS[r.complexity];
      if (suffix) {
        grouped[key]['func_' + suffix] = Math.round(r.total_func * 10) / 10;
        grouped[key]['tech_' + suffix] = Math.round(r.total_tech * 10) / 10;
      }
    }

    const classifKeys = Object.keys(grouped);

    // Build team lookup from dropdown categories (CLASSIFICATION_DEV/BI/MIG)
    const CAT_TO_TEAM = { CLASSIFICATION_DEV: 'DEV', CLASSIFICATION_BI: 'BI', CLASSIFICATION_MIG: 'MIGRATION' };
    const teamByClassif = {};
    const { rows: catRows } = await pool.query(
      `SELECT dc.code, dv.value FROM dropdown_categories dc
       JOIN dropdown_values dv ON dv.category_id = dc.id
       WHERE dc.code IN ('CLASSIFICATION_DEV','CLASSIFICATION_BI','CLASSIFICATION_MIG')
         AND dc.version_id = $1 AND dv.is_active = true AND dv.is_separator = false`,
      [vid]
    );
    for (const cr of catRows) {
      if (cr.value !== 'TOTAL') {
        teamByClassif[cr.value] = CAT_TO_TEAM[cr.code] || 'DEV';
      }
    }

    const { rows: defs } = await pool.query(
      `SELECT * FROM complexity_definitions WHERE version_id = $1`,
      [vid]
    );
    const defMap = {};
    for (const d of defs) {
      defMap[d.classification_group + ' / ' + d.subgroup] = d;
    }

    const defIds = defs.map(d => d.id);
    let factorMap = {};
    if (defIds.length > 0) {
      const { rows: factors } = await pool.query(
        `SELECT * FROM complexity_factors WHERE definition_id = ANY($1) ORDER BY sort_order`,
        [defIds]
      );
      for (const f of factors) {
        if (!factorMap[f.definition_id]) factorMap[f.definition_id] = [];
        factorMap[f.definition_id].push(f);
      }
    }

    const result = classifKeys.map(key => {
      const entry = grouped[key];
      const def = defMap[key];
      if (def) {
        entry.id = def.id;
        entry.team = def.team;
        entry.factors = factorMap[def.id] || [];
      }
      if (!entry.team) {
        entry.team = teamByClassif[key] || 'DEV';
      }
      return entry;
    });

    res.json(result);
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

// Update team assignment + factors only (numeric values are calculated)
router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(
      `UPDATE complexity_definitions SET team=$1, classification_group=$2, subgroup=$3 WHERE id=$4`,
      [b.team, b.classification_group, b.subgroup, req.params.id]
    );
    if (Array.isArray(b.factors)) {
      await pool.query('DELETE FROM complexity_factors WHERE definition_id = $1', [req.params.id]);
      for (const f of b.factors) {
        await pool.query(
          `INSERT INTO complexity_factors (definition_id, factor_name, value_very_low, value_low, value_medium, value_high, value_very_high, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [req.params.id, f.factor_name, f.value_very_low, f.value_low, f.value_medium, f.value_high, f.value_very_high, f.sort_order || 0]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Create a definition entry (for linking factors to a classification)
router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    const { rows } = await pool.query(
      `INSERT INTO complexity_definitions (version_id, team, classification_group, subgroup)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [b.version_id || 1, b.team, b.classification_group, b.subgroup]
    );
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
