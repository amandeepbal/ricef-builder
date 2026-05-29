const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    res.json((await pool.query('SELECT * FROM config_versions WHERE is_active = 1 ORDER BY id DESC')).rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const ver = (await pool.query('SELECT * FROM config_versions WHERE id = $1', [req.params.id])).rows[0];
    if (!ver) return res.status(404).json({ error: 'Version not found' });
    res.json(ver);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, description, valid_from, valid_to } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await pool.query(
      'INSERT INTO config_versions (name, description, valid_from, valid_to) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, description || null, valid_from || null, valid_to || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, description, valid_from, valid_to, is_active } = req.body;

    await pool.query(
      'UPDATE config_versions SET name=$1, description=$2, valid_from=$3, valid_to=$4, is_active=$5 WHERE id=$6',
      [name, description, valid_from || null, valid_to || null, is_active != null ? is_active : 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    if (Number(req.params.id) === 1) return res.status(400).json({ error: 'Cannot delete the default version' });
    await pool.query('UPDATE config_versions SET is_active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Get projects assigned to this version
router.get('/:id/projects', async (req, res, next) => {
  try {
    const pool = getPool();
    const projects = (await pool.query(
      'SELECT id, project_number, description FROM projects WHERE config_version_id = $1 AND is_active = 1 ORDER BY project_number',
      [req.params.id]
    )).rows;
    res.json(projects);
  } catch (e) {
    next(e);
  }
});

// Bulk-assign projects to this version
router.put('/:id/projects', async (req, res, next) => {
  try {
    const pool = getPool();
    const versionId = Number(req.params.id);
    if (versionId === 1) return res.status(400).json({ error: 'Cannot assign projects to the Template version. Clone it first.' });
    const ver = (await pool.query('SELECT id FROM config_versions WHERE id = $1', [versionId])).rows[0];
    if (!ver) return res.status(404).json({ error: 'Version not found' });

    const { project_ids } = req.body;
    if (!Array.isArray(project_ids)) return res.status(400).json({ error: 'project_ids must be an array' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Unassign projects currently on this version that are NOT in the new list
      await client.query(
        'UPDATE projects SET config_version_id = 1 WHERE config_version_id = $1 AND is_active = 1',
        [versionId]
      );
      // Assign the selected projects
      for (const pid of project_ids) {
        await client.query('UPDATE projects SET config_version_id = $1 WHERE id = $2 AND is_active = 1', [versionId, pid]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, assigned: project_ids.length });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/clone', async (req, res, next) => {
  try {
    const pool = getPool();
    const srcId = Number(req.params.id);
    const src = (await pool.query('SELECT * FROM config_versions WHERE id = $1', [srcId])).rows[0];
    if (!src) return res.status(404).json({ error: 'Source version not found' });

    const { name, valid_from, valid_to } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: newVerRows } = await client.query(
        'INSERT INTO config_versions (name, description, valid_from, valid_to) VALUES ($1,$2,$3,$4) RETURNING id',
        [name, 'Cloned from ' + src.name, valid_from || null, valid_to || null]
      );
      const newId = newVerRows[0].id;

      const copySimple = async (table) => {
        const colResult = await client.query(
          "SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1", [table]
        );
        const cols = colResult.rows.map(c => c.name)
          .filter(c => c !== 'id' && c !== 'version_id');
        const colList = cols.join(', ');
        await client.query(
          `INSERT INTO ${table} (version_id, ${colList}) SELECT $1, ${colList} FROM ${table} WHERE version_id = $2`,
          [newId, srcId]
        );
      };

      // Simple tables (no child rows)
      await copySimple('ricef_types');
      await copySimple('estimation_grid');
      await copySimple('sheet_column_config');

      // Blended rates: configs -> levels -> rates + effort_by_complexity
      const srcConfigs = (await client.query('SELECT * FROM blended_rate_configs WHERE version_id = $1', [srcId])).rows;
      for (const cfg of srcConfigs) {
        const { rows: newCfgRows } = await client.query(
          'INSERT INTO blended_rate_configs (version_id, team_prefix, team_label, is_active) VALUES ($1,$2,$3,$4) RETURNING id',
          [newId, cfg.team_prefix, cfg.team_label, cfg.is_active]
        );
        const newCfgId = newCfgRows[0].id;

        // Effort by complexity
        const ebcs = (await client.query('SELECT * FROM blended_effort_by_complexity WHERE config_id = $1', [cfg.id])).rows;
        for (const ebc of ebcs) {
          await client.query('INSERT INTO blended_effort_by_complexity (config_id, complexity, multiplier) VALUES ($1,$2,$3)',
            [newCfgId, ebc.complexity, ebc.multiplier]);
        }

        // Delivery levels -> rates
        const levels = (await client.query('SELECT * FROM blended_delivery_levels WHERE config_id = $1', [cfg.id])).rows;
        for (const lvl of levels) {
          const { rows: newLvlRows } = await client.query(
            'INSERT INTO blended_delivery_levels (config_id, level_number, level_label) VALUES ($1,$2,$3) RETURNING id',
            [newCfgId, lvl.level_number, lvl.level_label]
          );
          const newLvlId = newLvlRows[0].id;

          const rates = (await client.query('SELECT * FROM blended_rates WHERE level_id = $1', [lvl.id])).rows;
          for (const rate of rates) {
            await client.query(
              'INSERT INTO blended_rates (level_id, currency, billable_rate, effort_multiplier, blended_cost, margin_pct) VALUES ($1,$2,$3,$4,$5,$6)',
              [newLvlId, rate.currency, rate.billable_rate, rate.effort_multiplier, rate.blended_cost, rate.margin_pct]
            );
          }
        }
      }

      // Complexity definitions -> factors
      const srcDefs = (await client.query('SELECT * FROM complexity_definitions WHERE version_id = $1', [srcId])).rows;
      for (const def of srcDefs) {
        const defCols = ['team', 'classification_group', 'subgroup'];
        const vals = defCols.map(c => def[c]);
        const placeholders = defCols.map((_, i) => `$${i + 2}`).join(',');
        const { rows: newDefRows } = await client.query(
          `INSERT INTO complexity_definitions (version_id, ${defCols.join(',')}) VALUES ($1,${placeholders}) RETURNING id`,
          [newId, ...vals]
        );
        const newDefId = newDefRows[0].id;

        const factors = (await client.query('SELECT * FROM complexity_factors WHERE definition_id = $1', [def.id])).rows;
        for (const f of factors) {
          await client.query(
            `INSERT INTO complexity_factors (definition_id, factor_name, value_very_low, value_low, value_medium, value_high, value_very_high, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [newDefId, f.factor_name, f.value_very_low, f.value_low, f.value_medium, f.value_high, f.value_very_high, f.sort_order]
          );
        }
      }

      // Dropdown categories -> values
      const srcCats = (await client.query('SELECT * FROM dropdown_categories WHERE version_id = $1', [srcId])).rows;
      for (const cat of srcCats) {
        const { rows: newCatRows } = await client.query(
          'INSERT INTO dropdown_categories (version_id, code, label, is_system) VALUES ($1,$2,$3,$4) RETURNING id',
          [newId, cat.code, cat.label, cat.is_system]
        );
        const newCatId = newCatRows[0].id;

        const vals = (await client.query('SELECT * FROM dropdown_values WHERE category_id = $1', [cat.id])).rows;
        for (const v of vals) {
          await client.query(
            'INSERT INTO dropdown_values (category_id, value, display_label, is_separator, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6)',
            [newCatId, v.value, v.display_label, v.is_separator, v.sort_order, v.is_active]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ id: newId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

module.exports = router;
