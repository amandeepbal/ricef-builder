const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

function captureProjectState(db, pid) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  const factors = db.prepare('SELECT * FROM project_factors WHERE project_id = ?').get(pid);
  const phases = db.prepare('SELECT * FROM project_phases WHERE project_id = ?').get(pid);
  const funcPhasePct = db.prepare('SELECT * FROM project_func_phase_pct WHERE project_id = ?').get(pid);
  const pgo = db.prepare('SELECT * FROM project_pgo WHERE project_id = ?').get(pid);
  const contingency = db.prepare('SELECT * FROM project_contingency WHERE project_id = ?').get(pid);
  const scopeConfig = db.prepare('SELECT * FROM project_scope_config WHERE project_id = ?').get(pid);
  const scopeItems = db.prepare('SELECT * FROM project_scope_items WHERE project_id = ? ORDER BY id').all(pid);
  const sheetFuncPct = db.prepare('SELECT * FROM project_sheet_func_pct WHERE project_id = ? ORDER BY sheet_type_code').all(pid);
  const fixedRoles = db.prepare('SELECT * FROM project_fixed_roles WHERE project_id = ? ORDER BY team, id').all(pid);
  const staffingProfiles = db.prepare('SELECT * FROM project_staffing_profiles WHERE project_id = ? ORDER BY team, sort_order').all(pid);

  const items = db.prepare(`
    SELECT i.*, rt.label as type_label, rt.code as type_code, rt.sheet_type_code
    FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
    WHERE i.project_id = ? ORDER BY rt.sort_order, i.ricef_number, i.seq_number
  `).all(pid);

  const activeItems = items.filter(i => i.seq_number > 0);
  const totalHours = activeItems.reduce((s, i) => s + (i.grand_total_hours || 0), 0);

  return {
    project,
    factors,
    phases,
    funcPhasePct,
    pgo,
    contingency,
    scopeConfig,
    scopeItems,
    sheetFuncPct,
    fixedRoles,
    staffingProfiles,
    items,
    _meta: {
      totalItems: activeItems.length,
      totalHours: Math.round(totalHours),
      totalFunc: Math.round(activeItems.reduce((s, i) => s + (i.total_func_hours || 0), 0)),
      totalTech: Math.round(activeItems.reduce((s, i) => s + (i.total_tech_hours || 0), 0))
    }
  };
}

router.get('/:projectId/snapshots', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, project_id, phase, label, total_items, total_hours, created_at FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.projectId);
  res.json(rows);
});

router.post('/:projectId/snapshots', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const { phase, label } = req.body;
  if (!phase) return res.status(400).json({ error: 'phase is required' });

  const state = captureProjectState(db, pid);
  const json = JSON.stringify(state);

  const result = db.prepare(
    `INSERT INTO project_snapshots (project_id, phase, label, total_items, total_hours, snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(pid, phase, label || null, state._meta.totalItems, state._meta.totalHours, json);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/:projectId/snapshots/:snapshotId', (req, res) => {
  const db = getDb();
  const snap = db.prepare(
    'SELECT * FROM project_snapshots WHERE id = ? AND project_id = ?'
  ).get(req.params.snapshotId, req.params.projectId);
  if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

  snap.data = JSON.parse(snap.snapshot_json);
  delete snap.snapshot_json;
  res.json(snap);
});

router.get('/:projectId/compare/:snapshotId', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const snap = db.prepare(
    'SELECT * FROM project_snapshots WHERE id = ? AND project_id = ?'
  ).get(req.params.snapshotId, pid);
  if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

  const current = captureProjectState(db, pid);
  const previous = JSON.parse(snap.snapshot_json);

  const diff = buildDiff(current, previous);
  diff.snapshot = { id: snap.id, phase: snap.phase, label: snap.label, created_at: snap.created_at };
  diff.currentMeta = current._meta;
  diff.previousMeta = previous._meta;

  res.json(diff);
});

function buildDiff(current, previous) {
  const phases = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];

  const diffFields = (cur, prev, fields) => {
    if (!cur || !prev) return null;
    const changes = {};
    let hasChange = false;
    fields.forEach(f => {
      if (cur[f] !== prev[f]) {
        changes[f] = { current: cur[f], previous: prev[f] };
        hasChange = true;
      }
    });
    return hasChange ? changes : null;
  };

  const controlDiff = {};

  controlDiff.factors = diffFields(current.factors, previous.factors,
    ['cont_func_pct', 'cont_tech_pct', 'sit_func_pct', 'sit_tech_pct']);

  controlDiff.phases = diffFields(current.phases, previous.phases, phases);

  controlDiff.funcPhasePct = diffFields(current.funcPhasePct, previous.funcPhasePct,
    [...phases, 'architect_pct', 'arch_prep', 'arch_fts', 'arch_design', 'arch_build', 'arch_sit_uat', 'arch_dep', 'arch_hyp']);

  controlDiff.pgo = diffFields(current.pgo, previous.pgo,
    [...phases, 'lead_split', 'consultant_split']);

  controlDiff.contingency = diffFields(current.contingency, previous.contingency, phases);

  controlDiff.scopeConfig = diffFields(current.scopeConfig, previous.scopeConfig,
    ['low_hours', 'medium_hours', 'high_hours', 'kdd_hours', 'ip_hours', 'complexity_multiplier']);

  // Sheet func pct — keyed by sheet_type_code
  const sheetPctDiff = {};
  const prevSheetMap = {};
  (previous.sheetFuncPct || []).forEach(s => { prevSheetMap[s.sheet_type_code] = s; });
  (current.sheetFuncPct || []).forEach(s => {
    const d = diffFields(s, prevSheetMap[s.sheet_type_code], phases);
    if (d) sheetPctDiff[s.sheet_type_code] = d;
  });
  controlDiff.sheetFuncPct = Object.keys(sheetPctDiff).length > 0 ? sheetPctDiff : null;

  // Fixed roles — keyed by team + role_name
  const fixedRoleDiff = {};
  const prevRoleMap = {};
  (previous.fixedRoles || []).forEach(r => { prevRoleMap[r.team + '|' + r.role_name] = r; });
  (current.fixedRoles || []).forEach(r => {
    const key = r.team + '|' + r.role_name;
    const d = diffFields(r, prevRoleMap[key], phases);
    if (d) fixedRoleDiff[key] = d;
  });
  controlDiff.fixedRoles = Object.keys(fixedRoleDiff).length > 0 ? fixedRoleDiff : null;

  // Scope items — keyed by func_role + lob
  const scopeDiff = { changed: [], added: [], removed: [] };
  const prevScopeMap = {};
  (previous.scopeItems || []).forEach(s => { prevScopeMap[s.func_role + '|' + s.lob] = s; });
  const curScopeKeys = new Set();
  (current.scopeItems || []).forEach(s => {
    const key = s.func_role + '|' + s.lob;
    curScopeKeys.add(key);
    const prev = prevScopeMap[key];
    if (!prev) {
      scopeDiff.added.push(s);
    } else {
      const fields = ['low_count', 'medium_count', 'high_count', 'very_high_hours', 'localization_hours', 'kdd_count', 'ip_count'];
      const d = diffFields(s, prev, fields);
      if (d) scopeDiff.changed.push({ key, changes: d });
    }
  });
  Object.keys(prevScopeMap).forEach(key => {
    if (!curScopeKeys.has(key)) scopeDiff.removed.push(prevScopeMap[key]);
  });

  // Items — keyed by id (stable unique key; ricef_number+seq is not unique for sub-items)
  const itemFields = ['description', 'status', 'complexity', 'classification', 'module',
    'func_effort_adj', 'tech_effort_adj', 'func_role', 'tech_role',
    'build_func', 'build_tech', 'sit_func', 'sit_tech', 'sub_items_func', 'sub_items_tech',
    'total_func_hours', 'total_tech_hours', 'grand_total_hours'];
  const itemDiff = { changed: [], added: [], removed: [] };
  const prevItemMap = {};
  (previous.items || []).forEach(i => { prevItemMap[i.id] = i; });
  const curItemIds = new Set();
  (current.items || []).forEach(i => {
    curItemIds.add(i.id);
    const prev = prevItemMap[i.id];
    if (!prev) {
      itemDiff.added.push({ ricef_number: i.ricef_number, seq_number: i.seq_number, type_label: i.type_label, description: i.description });
    } else {
      const d = diffFields(i, prev, itemFields);
      if (d) {
        itemDiff.changed.push({
          ricef_number: i.ricef_number,
          seq_number: i.seq_number,
          type_label: i.type_label,
          description: i.description,
          changes: d
        });
      }
    }
  });
  Object.keys(prevItemMap).forEach(id => {
    if (!curItemIds.has(Number(id))) {
      const p = prevItemMap[id];
      itemDiff.removed.push({ ricef_number: p.ricef_number, seq_number: p.seq_number, type_label: p.type_label, description: p.description });
    }
  });

  return { controlDiff, scopeDiff, itemDiff };
}

router.delete('/:projectId/snapshots/:snapshotId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_snapshots WHERE id = ? AND project_id = ?')
    .run(req.params.snapshotId, req.params.projectId);
  res.json({ ok: true });
});

module.exports = router;
