const { Router } = require('express');
const { getPool } = require('../db/connection');
const { buildSummary } = require('../services/summary-aggregator');
const router = Router();

async function captureProjectState(pool, pid) {
  const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
  const factors = (await pool.query('SELECT * FROM project_factors WHERE project_id = $1', [pid])).rows[0];
  const phases = (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [pid])).rows[0];
  const funcPhasePct = (await pool.query('SELECT * FROM project_func_phase_pct WHERE project_id = $1', [pid])).rows[0];
  const pgo = (await pool.query('SELECT * FROM project_pgo WHERE project_id = $1', [pid])).rows[0];
  const contingency = (await pool.query('SELECT * FROM project_contingency WHERE project_id = $1', [pid])).rows[0];
  const scopeConfig = (await pool.query('SELECT * FROM project_scope_config WHERE project_id = $1', [pid])).rows[0];
  const scopeItems = (await pool.query('SELECT * FROM project_scope_items WHERE project_id = $1 ORDER BY id', [pid])).rows;
  const sheetFuncPct = (await pool.query('SELECT * FROM project_sheet_func_pct WHERE project_id = $1 ORDER BY sheet_type_code, grid_type', [pid])).rows;
  const fixedRoles = (await pool.query('SELECT * FROM project_fixed_roles WHERE project_id = $1 ORDER BY team, grid_type, id', [pid])).rows;
  const staffingProfiles = (await pool.query('SELECT * FROM project_staffing_profiles WHERE project_id = $1 ORDER BY team, sort_order', [pid])).rows;

  const items = (await pool.query(`
    SELECT i.*, rt.label as type_label, rt.code as type_code, rt.sheet_type_code
    FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
    WHERE i.project_id = $1 ORDER BY rt.sort_order, i.ricef_number, i.seq_number
  `, [pid])).rows;

  const activeItems = items.filter(i => i.seq_number > 0);
  const totalHours = activeItems.reduce((s, i) => s + (i.grand_total_hours || 0), 0);

  // Capture calculated outputs
  const summary = await buildSummary(pool, pid);
  const P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];

  function flattenRows(rows) {
    return (rows || []).map(r => {
      const row = { role: r.role || '' };
      P.forEach(p => { row[p] = Math.round(r[p] || 0); });
      row.total = Math.round(r.total || P.reduce((s, p) => s + (row[p] || 0), 0));
      if (r.lead != null) row.lead = Math.round(r.lead);
      if (r.consultant != null) row.consultant = Math.round(r.consultant);
      return row;
    });
  }

  const archRow = summary.funcArchitect || {};
  archRow._highlight = true;
  const funcTotalRows = [archRow].concat(summary.funcByRole || []);

  const calculated = {
    orangeGrid: {
      RICEF: { funcRows: flattenRows(summary.sheetFunc && summary.sheetFunc.RICEF), techRows: flattenRows(summary.techDev) },
      BI: { funcRows: flattenRows(summary.sheetFunc && summary.sheetFunc.BI), techRows: flattenRows(summary.techBi) },
      MIGRATION: { funcRows: flattenRows(summary.sheetFunc && summary.sheetFunc.MIGRATION), techRows: flattenRows(summary.techMig) }
    },
    funcEffort: {
      scopeEffort: flattenRows(summary.funcScopeEffort),
      techScopeEffort: flattenRows(summary.techScopeEffort),
      totalEffort: flattenRows(funcTotalRows)
    },
    summary: {
      phases: flattenRows(summary.phases),
      funcScope: flattenRows(summary.funcByRole),
      funcArchitect: flattenRows([summary.funcArchitect || {}]),
      techDev: flattenRows(summary.techDev),
      techBi: flattenRows(summary.techBi),
      techMig: flattenRows(summary.techMig)
    },
    summaryTotals: {
      totalFunc: summary.totalFunc || 0,
      totalTech: summary.totalTech || 0,
      totalPgo: summary.totalPgo || 0,
      totalGrand: summary.totalGrand || 0,
      itemCount: summary.itemCount || 0
    }
  };

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
    calculated,
    _meta: {
      totalItems: activeItems.length,
      totalHours: Math.round(totalHours),
      totalFunc: Math.round(activeItems.reduce((s, i) => s + (i.total_func_hours || 0), 0)),
      totalTech: Math.round(activeItems.reduce((s, i) => s + (i.total_tech_hours || 0), 0))
    }
  };
}

router.get('/:projectId/snapshots', async (req, res, next) => {
  try {
    const pool = getPool();
    const rows = (await pool.query(
      'SELECT id, project_id, phase, label, total_items, total_hours, created_at FROM project_snapshots WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.projectId]
    )).rows;
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/:projectId/snapshots', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const { phase, label } = req.body;
    if (!phase) return res.status(400).json({ error: 'phase is required' });

    const state = await captureProjectState(pool, pid);
    const json = JSON.stringify(state);

    const { rows } = await pool.query(
      `INSERT INTO project_snapshots (project_id, phase, label, total_items, total_hours, snapshot_json)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [pid, phase, label || null, state._meta.totalItems, state._meta.totalHours, json]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/snapshots/:snapshotId', async (req, res, next) => {
  try {
    const pool = getPool();
    const snap = (await pool.query(
      'SELECT * FROM project_snapshots WHERE id = $1 AND project_id = $2',
      [req.params.snapshotId, req.params.projectId]
    )).rows[0];
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

    snap.data = JSON.parse(snap.snapshot_json);
    delete snap.snapshot_json;
    res.json(snap);
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/compare/:snapshotId', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const snap = (await pool.query(
      'SELECT * FROM project_snapshots WHERE id = $1 AND project_id = $2',
      [req.params.snapshotId, pid]
    )).rows[0];
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

    const current = await captureProjectState(pool, pid);
    const previous = JSON.parse(snap.snapshot_json);

    const diff = buildDiff(current, previous);
    diff.snapshot = { id: snap.id, phase: snap.phase, label: snap.label, created_at: snap.created_at };
    diff.currentMeta = current._meta;
    diff.previousMeta = previous._meta;
    diff.currentCalculated = current.calculated || null;
    diff.previousCalculated = previous.calculated || null;

    res.json(diff);
  } catch (e) {
    next(e);
  }
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

  // Sheet func pct — keyed by sheet_type_code + grid_type
  const sheetPctDiff = {};
  const prevSheetMap = {};
  (previous.sheetFuncPct || []).forEach(s => { prevSheetMap[(s.sheet_type_code || '') + '|' + (s.grid_type || 'ORANGE')] = s; });
  (current.sheetFuncPct || []).forEach(s => {
    const key = (s.sheet_type_code || '') + '|' + (s.grid_type || 'ORANGE');
    const d = diffFields(s, prevSheetMap[key], phases);
    if (d) sheetPctDiff[key] = d;
  });
  controlDiff.sheetFuncPct = Object.keys(sheetPctDiff).length > 0 ? sheetPctDiff : null;

  // Fixed roles — keyed by team + role_name + grid_type
  const fixedRoleDiff = {};
  const prevRoleMap = {};
  (previous.fixedRoles || []).forEach(r => { prevRoleMap[r.team + '|' + r.role_name + '|' + (r.grid_type || 'ORANGE')] = r; });
  (current.fixedRoles || []).forEach(r => {
    const key = r.team + '|' + r.role_name + '|' + (r.grid_type || 'ORANGE');
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

  // Items — keyed by id
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

  // Calculated output diff — compare computed grid/summary values
  const calculatedDiff = buildCalculatedDiff(current.calculated, previous.calculated);

  return { controlDiff, scopeDiff, itemDiff, calculatedDiff };
}

function buildCalculatedDiff(cur, prev) {
  if (!cur || !prev) return null;
  const P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp', 'total'];
  const result = { grids: [], summaryTotals: null };

  function diffGridRows(curRows, prevRows, sectionLabel) {
    const prevMap = {};
    (prevRows || []).forEach(r => { prevMap[r.role] = r; });
    const changes = [];
    (curRows || []).forEach(r => {
      const prev = prevMap[r.role];
      if (!prev) {
        changes.push({ role: r.role, type: 'added', current: r });
      } else {
        const fieldChanges = {};
        let hasChange = false;
        P.forEach(p => {
          const cv = r[p] || 0;
          const pv = prev[p] || 0;
          if (cv !== pv) {
            fieldChanges[p] = { current: cv, previous: pv, delta: cv - pv };
            hasChange = true;
          }
        });
        ['lead', 'consultant'].forEach(p => {
          if (r[p] != null || (prev[p] != null)) {
            const cv = r[p] || 0;
            const pv = prev[p] || 0;
            if (cv !== pv) {
              fieldChanges[p] = { current: cv, previous: pv, delta: cv - pv };
              hasChange = true;
            }
          }
        });
        if (hasChange) changes.push({ role: r.role, type: 'changed', fields: fieldChanges });
      }
    });
    (prevRows || []).forEach(r => {
      if (!(curRows || []).find(c => c.role === r.role)) {
        changes.push({ role: r.role, type: 'removed', previous: r });
      }
    });
    if (changes.length > 0) result.grids.push({ section: sectionLabel, changes });
  }

  // Orange Grid per sheet
  ['RICEF', 'BI', 'MIGRATION'].forEach(sheet => {
    const cg = (cur.orangeGrid || {})[sheet] || {};
    const pg = (prev.orangeGrid || {})[sheet] || {};
    diffGridRows(cg.funcRows, pg.funcRows, sheet + ' — Orange Grid FUNC');
    diffGridRows(cg.techRows, pg.techRows, sheet + ' — Orange Grid TECH');
  });

  // Functional effort
  const cfe = cur.funcEffort || {};
  const pfe = prev.funcEffort || {};
  diffGridRows(cfe.scopeEffort, pfe.scopeEffort, 'Functional Scope Effort');
  diffGridRows(cfe.techScopeEffort, pfe.techScopeEffort, 'Technical Scope Effort');
  diffGridRows(cfe.totalEffort, pfe.totalEffort, 'Total Functional Effort');

  // Summary page sections
  const csu = cur.summary || {};
  const psu = prev.summary || {};
  diffGridRows(csu.phases, psu.phases, 'Summary — Project Phases');
  diffGridRows(csu.funcArchitect, psu.funcArchitect, 'Summary — Architect');
  diffGridRows(csu.funcScope, psu.funcScope, 'Summary — Functional Scope');
  diffGridRows(csu.techDev, psu.techDev, 'Summary — Technical DEV');
  diffGridRows(csu.techBi, psu.techBi, 'Summary — Technical BI');
  diffGridRows(csu.techMig, psu.techMig, 'Summary — Technical Migration');

  // Summary totals
  const cs = cur.summaryTotals || {};
  const ps = prev.summaryTotals || {};
  const totalFields = {};
  let hasTotalChange = false;
  ['totalFunc', 'totalTech', 'totalPgo', 'totalGrand', 'itemCount'].forEach(f => {
    const cv = cs[f] || 0;
    const pv = ps[f] || 0;
    if (cv !== pv) {
      totalFields[f] = { current: cv, previous: pv, delta: cv - pv };
      hasTotalChange = true;
    }
  });
  result.summaryTotals = hasTotalChange ? totalFields : null;

  const hasChanges = result.grids.length > 0 || result.summaryTotals;
  return hasChanges ? result : null;
}

router.delete('/:projectId/snapshots/:snapshotId', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM project_snapshots WHERE id = $1 AND project_id = $2',
      [req.params.snapshotId, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
