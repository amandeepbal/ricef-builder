const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

function computeReadonly(project) {
  const today = new Date().toISOString().slice(0, 10);
  if (project.start_date && project.end_date) {
    project.is_readonly = !(project.start_date <= today && project.end_date >= today);
  } else {
    project.is_readonly = false;
  }
  return project;
}

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const rows = (await pool.query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM items WHERE project_id = p.id) AS item_count,
         (SELECT name FROM config_versions WHERE id = p.config_version_id) AS config_version_name
       FROM projects p WHERE p.is_active = 1 ORDER BY p.id DESC`
    )).rows;
    rows.forEach(computeReadonly);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { project_number, description, currency, delivery_level, start_date, end_date, config_version_id } = req.body;

    if (!project_number || !description) {
      return res.status(400).json({ error: 'Project number and description are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const verionId = config_version_id || 1;

      const { rows: projRows } = await client.query(
        `INSERT INTO projects (project_number, description, currency, delivery_level, start_date, end_date, config_version_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [project_number, description, currency || 'USD', delivery_level || 1, start_date || null, end_date || null, verionId]
      );
      const pid = projRows[0].id;

      // Item calculation factors (FUNC cont=0%, TECH cont=15%, SIT FUNC=10%, SIT TECH=12%)
      await client.query('INSERT INTO project_factors (project_id) VALUES ($1)', [pid]);

      // Phases (default weeks per phase)
      await client.query(`INSERT INTO project_phases (project_id, prep, fts, design, build, sit_uat, dep, hyp)
        VALUES ($1, 6, 6, 4, 14, 10, 1, 4)`, [pid]);

      // Functional phase distribution %
      await client.query(`INSERT INTO project_func_phase_pct (project_id, prep, fts, design, build, sit_uat, dep, hyp, architect_pct,
        arch_prep, arch_fts, arch_design, arch_build, arch_sit_uat, arch_dep, arch_hyp)
        VALUES ($1, 0.15, 0.15, 0.10, 0.30, 0.24, 0.06, 0.10, 0.10,
        0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10)`, [pid]);

      // PGO %
      await client.query(`INSERT INTO project_pgo (project_id, prep, fts, design, build, sit_uat, dep, hyp, lead_split, consultant_split)
        VALUES ($1, 0.20, 0.20, 0.20, 0.20, 0.20, 0.20, 0.15, 0.23, 0.80)`, [pid]);

      // Contingency %
      await client.query(`INSERT INTO project_contingency (project_id, prep, fts, design, build, sit_uat, dep, hyp)
        VALUES ($1, 0.10, 0.10, 0.10, 0.15, 0.15, 0.15, 0)`, [pid]);

      // Scope config (baseline hours for FUNCTIONAL scope items)
      await client.query(`INSERT INTO project_scope_config (project_id, low_hours, medium_hours, high_hours, kdd_hours, ip_hours, complexity_multiplier)
        VALUES ($1, 24, 48, 72, 40, -40, 1)`, [pid]);

      // Per-sheet FUNC phase distribution % (ORANGE = SYNTAX, BLUE = CUSTOMER)
      for (const gt of ['ORANGE', 'BLUE']) {
        await client.query(
          `INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [pid, 'RICEF', 0, 0, 0.25, 0.75, 0, 0.03, 0.10, gt]
        );
        await client.query(
          `INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [pid, 'BI', 0, 0, 0.25, 0.75, 0, 0.03, 0.10, gt]
        );
        await client.query(
          `INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [pid, 'MIGRATION', 0, 0, 0, 0.75, 0.25, 0, 0.10, gt]
        );
      }

      // Fixed roles (default template per team) — ORANGE + BLUE
      for (const gt of ['ORANGE', 'BLUE']) {
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'DEV', 'Architect TSA', 4, 8, 16, 4, 2, 0.03, 0.1, gt]
        );
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'DEV', 'Technical Lead - DEV', 2, 8, 16, 24, 20, 0.03, 0.1, gt]
        );
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'BI', 'Architect BI', 8, 8, 2, 0, 0, 0.03, 0, gt]
        );
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'BI', 'Technical Lead - BI', 0, 0, 8, 12, 2, 0.03, 0, gt]
        );
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'MIGRATION', 'Architect MIGRATION', 0, 0, 0, 0, 0, 0, 0, gt]
        );
        await client.query(
          `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp, grid_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [pid, 'MIGRATION', 'Technical Lead - MIGRATION', 20, 20, 20, 0, 0, 0.15, 0.1, gt]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ id: pid });
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

router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const factors = (await pool.query('SELECT * FROM project_factors WHERE project_id = $1', [req.params.id])).rows[0];
    project.factors = factors || {};
    computeReadonly(project);
    res.json(project);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { project_number, description, currency, delivery_level, start_date, end_date, config_version_id } = req.body;
    await pool.query(
      `UPDATE projects SET project_number=$1, description=$2, currency=$3, delivery_level=$4,
       start_date=$5, end_date=$6, config_version_id=$7, updated_at=NOW() WHERE id=$8`,
      [project_number, description, currency, delivery_level,
        start_date || null, end_date || null, config_version_id || 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('UPDATE projects SET is_active=0, updated_at=NOW() WHERE id=$1',
      [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/copy', async (req, res, next) => {
  try {
    const pool = getPool();
    const srcId = req.params.id;
    const src = (await pool.query('SELECT * FROM projects WHERE id = $1', [srcId])).rows[0];
    if (!src) return res.status(404).json({ error: 'Source project not found' });

    const { project_number, description } = req.body;
    if (!project_number || !description) {
      return res.status(400).json({ error: 'project_number and description are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: newProjRows } = await client.query(
        `INSERT INTO projects (project_number, description, currency, delivery_level)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [project_number, description, src.currency, src.delivery_level]
      );
      const newId = newProjRows[0].id;

      const copyTable = async (table, extraExclude) => {
        const exclude = new Set(['id', 'project_id', 'created_at', 'updated_at', ...(extraExclude || [])]);
        const colResult = await client.query(
          "SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1", [table]
        );
        const cols = colResult.rows.map(c => c.name)
          .filter(c => !exclude.has(c));
        if (cols.length === 0) return;
        const colList = cols.join(', ');
        await client.query(
          `INSERT INTO ${table} (project_id, ${colList})
           SELECT $1, ${colList} FROM ${table} WHERE project_id = $2`,
          [newId, srcId]
        );
      };

      await copyTable('project_factors');
      await copyTable('project_phases');
      await copyTable('project_func_phase_pct');
      await copyTable('project_pgo');
      await copyTable('project_contingency');
      await copyTable('project_scope_config');
      await copyTable('project_scope_items');
      await copyTable('project_sheet_func_pct');
      await copyTable('project_fixed_roles');
      await copyTable('project_staffing_profiles');

      const srcItems = (await client.query('SELECT * FROM items WHERE project_id = $1', [srcId])).rows;
      if (srcItems.length > 0) {
        const itemExclude = new Set(['id', 'project_id', 'created_at', 'updated_at']);
        const itemCols = Object.keys(srcItems[0]).filter(c => !itemExclude.has(c));
        const colList = itemCols.join(', ');
        const placeholders = itemCols.map((_, i) => `$${i + 2}`).join(', ');
        for (const item of srcItems) {
          await client.query(
            `INSERT INTO items (project_id, ${colList}) VALUES ($1, ${placeholders})`,
            [newId, ...itemCols.map(c => item[c])]
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
