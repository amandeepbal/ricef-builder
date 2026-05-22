const { Router } = require('express');
const { getDb } = require('../db/connection');
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

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT p.*,
       (SELECT COUNT(*) FROM items WHERE project_id = p.id) AS item_count
     FROM projects p WHERE p.is_active = 1 ORDER BY p.id DESC`
  ).all();
  rows.forEach(computeReadonly);
  res.json(rows);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { project_number, description, currency, delivery_level, start_date, end_date, config_version_id } = req.body;

  if (!project_number || !description) {
    return res.status(400).json({ error: 'Project number and description are required' });
  }

  const create = db.transaction(() => {
    // Resolve config version: explicit > date-based > default
    let verionId = config_version_id;
    if (!verionId && start_date) {
      const ver = db.prepare(
        `SELECT id FROM config_versions WHERE is_active = 1 AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1`
      ).get(start_date, start_date);
      verionId = ver ? ver.id : 1;
    }
    verionId = verionId || 1;

    const result = db.prepare(
      `INSERT INTO projects (project_number, description, currency, delivery_level, start_date, end_date, config_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(project_number, description, currency || 'USD', delivery_level || 1, start_date || null, end_date || null, verionId);
    const pid = result.lastInsertRowid;

    // Item calculation factors (FUNC cont=0%, TECH cont=15%, SIT FUNC=10%, SIT TECH=12%)
    db.prepare('INSERT INTO project_factors (project_id) VALUES (?)').run(pid);

    // Phases (default weeks per phase)
    db.prepare(`INSERT INTO project_phases (project_id, prep, fts, design, build, sit_uat, dep, hyp)
      VALUES (?, 6, 6, 4, 14, 10, 1, 4)`).run(pid);

    // Functional phase distribution %
    db.prepare(`INSERT INTO project_func_phase_pct (project_id, prep, fts, design, build, sit_uat, dep, hyp, architect_pct,
      arch_prep, arch_fts, arch_design, arch_build, arch_sit_uat, arch_dep, arch_hyp)
      VALUES (?, 0.15, 0.15, 0.10, 0.30, 0.24, 0.06, 0.10, 0.10,
      0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10)`).run(pid);

    // PGO %
    db.prepare(`INSERT INTO project_pgo (project_id, prep, fts, design, build, sit_uat, dep, hyp, lead_split, consultant_split)
      VALUES (?, 0.20, 0.20, 0.20, 0.20, 0.20, 0.20, 0.15, 0.23, 0.80)`).run(pid);

    // Contingency %
    db.prepare(`INSERT INTO project_contingency (project_id, prep, fts, design, build, sit_uat, dep, hyp)
      VALUES (?, 0.10, 0.10, 0.10, 0.15, 0.15, 0.15, 0)`).run(pid);

    // Scope config (baseline hours for FUNCTIONAL scope items)
    db.prepare(`INSERT INTO project_scope_config (project_id, low_hours, medium_hours, high_hours, kdd_hours, ip_hours, complexity_multiplier)
      VALUES (?, 24, 48, 72, 40, -40, 1)`).run(pid);

    // Per-sheet FUNC phase distribution %
    db.prepare(`INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp)
      VALUES (?, 'RICEF', 0, 0, 0.25, 0.75, 0, 0.03, 0.10)`).run(pid);
    db.prepare(`INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp)
      VALUES (?, 'BI', 0, 0, 0.25, 0.75, 0, 0.03, 0.10)`).run(pid);
    db.prepare(`INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp)
      VALUES (?, 'MIGRATION', 0, 0, 0, 0.75, 0.25, 0, 0.10)`).run(pid);

    // Fixed roles (default template per team)
    const insertFixed = db.prepare(
      `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    insertFixed.run(pid, 'DEV', 'Architect TSA',         4, 8, 16, 4, 2, 0.03, 0.1);
    insertFixed.run(pid, 'DEV', 'Technical Lead - DEV',  2, 8, 16, 24, 20, 0.03, 0.1);
    insertFixed.run(pid, 'BI',  'Architect BI',          8, 8, 2, 0, 0, 0.03, 0);
    insertFixed.run(pid, 'BI',  'Technical Lead - BI',   0, 0, 8, 12, 2, 0.03, 0);
    insertFixed.run(pid, 'MIGRATION', 'Architect MIGRATION',         0, 0, 0, 0, 0, 0, 0);
    insertFixed.run(pid, 'MIGRATION', 'Technical Lead - MIGRATION', 20,20,20, 0, 0, 0.15, 0.1);

    return pid;
  });

  const pid = create();
  res.status(201).json({ id: pid });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const factors = db.prepare('SELECT * FROM project_factors WHERE project_id = ?').get(req.params.id);
  project.factors = factors || {};
  computeReadonly(project);
  res.json(project);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { project_number, description, currency, delivery_level, start_date, end_date, config_version_id } = req.body;
  db.prepare(
    `UPDATE projects SET project_number=?, description=?, currency=?, delivery_level=?,
     start_date=?, end_date=?, config_version_id=?, updated_at=datetime('now') WHERE id=?`
  ).run(project_number, description, currency, delivery_level,
    start_date || null, end_date || null, config_version_id || 1, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE projects SET is_active=0, updated_at=datetime(\'now\') WHERE id=?')
    .run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/copy', (req, res) => {
  const db = getDb();
  const srcId = req.params.id;
  const src = db.prepare('SELECT * FROM projects WHERE id = ?').get(srcId);
  if (!src) return res.status(404).json({ error: 'Source project not found' });

  const { project_number, description } = req.body;
  if (!project_number || !description) {
    return res.status(400).json({ error: 'project_number and description are required' });
  }

  const copy = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO projects (project_number, description, currency, delivery_level)
       VALUES (?, ?, ?, ?)`
    ).run(project_number, description, src.currency, src.delivery_level);
    const newId = result.lastInsertRowid;

    const copyTable = (table, extraExclude) => {
      const exclude = new Set(['id', 'project_id', 'created_at', 'updated_at', ...(extraExclude || [])]);
      const cols = db.prepare(`PRAGMA table_info(${table})`).all()
        .map(c => c.name)
        .filter(c => !exclude.has(c));
      if (cols.length === 0) return;
      const colList = cols.join(', ');
      db.prepare(
        `INSERT INTO ${table} (project_id, ${colList})
         SELECT ?, ${colList} FROM ${table} WHERE project_id = ?`
      ).run(newId, srcId);
    };

    copyTable('project_factors');
    copyTable('project_phases');
    copyTable('project_func_phase_pct');
    copyTable('project_pgo');
    copyTable('project_contingency');
    copyTable('project_scope_config');
    copyTable('project_scope_items');
    copyTable('project_sheet_func_pct');
    copyTable('project_fixed_roles');
    copyTable('project_staffing_profiles');

    const srcItems = db.prepare('SELECT * FROM items WHERE project_id = ?').all(srcId);
    if (srcItems.length > 0) {
      const itemExclude = new Set(['id', 'project_id', 'created_at', 'updated_at']);
      const itemCols = Object.keys(srcItems[0]).filter(c => !itemExclude.has(c));
      const colList = itemCols.join(', ');
      const placeholders = itemCols.map(() => '?').join(', ');
      const ins = db.prepare(
        `INSERT INTO items (project_id, ${colList}) VALUES (?, ${placeholders})`
      );
      for (const item of srcItems) {
        ins.run(newId, ...itemCols.map(c => item[c]));
      }
    }

    return newId;
  });

  const newId = copy();
  res.status(201).json({ id: newId });
});

module.exports = router;
