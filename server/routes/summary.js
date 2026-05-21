const { Router } = require('express');
const { getDb } = require('../db/connection');
const { buildSummary } = require('../services/summary-aggregator');
const { calculateItem } = require('../services/estimation-engine');
const router = Router();

router.get('/:projectId/summary', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const summary = buildSummary(db, req.params.projectId);
  res.json(summary);
});

// GET analytics data for project dashboard
router.get('/:projectId/analytics', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const items = db.prepare(`
    SELECT i.*, rt.label as type_label, rt.code as type_code, rt.sheet_type_code
    FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
    WHERE i.project_id = ? AND i.seq_number > 0
  `).all(pid);

  const totalItems = items.length;
  const totalFunc = items.reduce((s, i) => s + (i.total_func_hours || 0), 0);
  const totalTech = items.reduce((s, i) => s + (i.total_tech_hours || 0), 0);
  const grandTotal = items.reduce((s, i) => s + (i.grand_total_hours || 0), 0);

  // By RICEF type
  const byTypeMap = {};
  items.forEach(i => {
    if (!byTypeMap[i.type_label]) byTypeMap[i.type_label] = { label: i.type_label, count: 0, hours: 0 };
    byTypeMap[i.type_label].count++;
    byTypeMap[i.type_label].hours += i.grand_total_hours || 0;
  });
  const byType = Object.values(byTypeMap).sort((a, b) => b.hours - a.hours);

  // By sheet
  const bySheetMap = {};
  items.forEach(i => {
    const s = i.sheet_type_code;
    if (!bySheetMap[s]) bySheetMap[s] = { label: s, count: 0, hours: 0 };
    bySheetMap[s].count++;
    bySheetMap[s].hours += i.grand_total_hours || 0;
  });
  const bySheet = Object.values(bySheetMap).sort((a, b) => b.hours - a.hours);

  // By complexity
  const byComplexMap = {};
  items.forEach(i => {
    const c = i.complexity || 'Unknown';
    if (!byComplexMap[c]) byComplexMap[c] = { label: c, count: 0, hours: 0 };
    byComplexMap[c].count++;
    byComplexMap[c].hours += i.grand_total_hours || 0;
  });
  const complexOrder = ['0-TBD', '1-Very Low', '2-Low', '3-Medium', '4-High', '5-Very High'];
  const byComplexity = complexOrder
    .filter(c => byComplexMap[c])
    .map(c => byComplexMap[c]);

  // By status
  const byStatusMap = {};
  items.forEach(i => {
    const s = i.status || 'Unknown';
    if (!byStatusMap[s]) byStatusMap[s] = { label: s, count: 0, hours: 0 };
    byStatusMap[s].count++;
    byStatusMap[s].hours += i.grand_total_hours || 0;
  });
  const byStatus = Object.values(byStatusMap).sort((a, b) => b.count - a.count);

  // By module
  const byModuleMap = {};
  items.forEach(i => {
    const m = i.module || 'Unassigned';
    if (!byModuleMap[m]) byModuleMap[m] = { label: m, count: 0, hours: 0 };
    byModuleMap[m].count++;
    byModuleMap[m].hours += i.grand_total_hours || 0;
  });
  const byModule = Object.values(byModuleMap).sort((a, b) => b.hours - a.hours).slice(0, 15);

  // TBD / risk
  const tbdItems = items.filter(i => i.complexity === '0-TBD');
  const tbdCount = tbdItems.length;
  const tbdHours = tbdItems.reduce((s, i) => s + (i.grand_total_hours || 0), 0);
  const cancelledCount = items.filter(i => i.status === 'Cancelled').length;
  const noClassification = items.filter(i => !i.classification || i.classification === '').length;

  // Top 10
  const top10 = [...items]
    .sort((a, b) => (b.grand_total_hours || 0) - (a.grand_total_hours || 0))
    .slice(0, 10)
    .map(i => ({
      ricef_number: i.ricef_number,
      description: i.description,
      type: i.type_label,
      complexity: i.complexity,
      hours: Math.round(i.grand_total_hours || 0)
    }));

  // --- Cost Analytics ---
  const teamPrefixMap = { RICEF: '(D)', BI: '(B)', MIGRATION: '(M)' };
  const rates = {};
  for (const prefix of ['(D)', '(B)', '(M)']) {
    const cfg = db.prepare('SELECT id FROM blended_rate_configs WHERE team_prefix = ?').get(prefix);
    if (!cfg) continue;
    const levels = db.prepare('SELECT * FROM blended_delivery_levels WHERE config_id = ? ORDER BY level_number').all(cfg.id);
    rates[prefix] = {};
    for (const lvl of levels) {
      const rate = db.prepare('SELECT * FROM blended_rates WHERE level_id = ? AND currency = ?').get(lvl.id, project.currency);
      if (rate) rates[prefix][lvl.level_number] = rate;
    }
  }

  const costBySheet = bySheet.map(s => {
    const prefix = teamPrefixMap[s.label] || '(D)';
    const rateData = rates[prefix] && rates[prefix][project.delivery_level];
    const billable = rateData ? Math.round(s.hours * rateData.billable_rate) : 0;
    const cost = rateData ? Math.round(s.hours * rateData.blended_cost) : 0;
    return { label: s.label, hours: Math.round(s.hours), billable, cost, rate: rateData ? rateData.billable_rate : 0 };
  });
  const totalBillable = costBySheet.reduce((s, c) => s + c.billable, 0);
  const totalCost = costBySheet.reduce((s, c) => s + c.cost, 0);

  const costComparison = [];
  for (let lvl = 1; lvl <= 3; lvl++) {
    let lvlBillable = 0;
    bySheet.forEach(s => {
      const prefix = teamPrefixMap[s.label] || '(D)';
      const rateData = rates[prefix] && rates[prefix][lvl];
      if (rateData) lvlBillable += Math.round(s.hours * rateData.billable_rate);
    });
    const lvlLabel = db.prepare(
      `SELECT bdl.level_label FROM blended_delivery_levels bdl
       JOIN blended_rate_configs brc ON bdl.config_id = brc.id
       WHERE brc.team_prefix = '(D)' AND bdl.level_number = ?`
    ).get(lvl);
    costComparison.push({
      level: lvl,
      label: lvlLabel ? lvlLabel.level_label : 'Level ' + lvl,
      billable: lvlBillable,
      isCurrent: lvl === project.delivery_level
    });
  }

  // --- Effort Concentration (Pareto) ---
  const sorted = [...items].sort((a, b) => (b.grand_total_hours || 0) - (a.grand_total_hours || 0));
  const pareto = [];
  let cumHrs = 0;
  sorted.forEach((item, idx) => {
    cumHrs += item.grand_total_hours || 0;
    const itemPct = Math.round((idx + 1) / totalItems * 100);
    const hrsPct = Math.round(cumHrs / (grandTotal || 1) * 100);
    if (itemPct === 10 || itemPct === 20 || itemPct === 30 || itemPct === 50 || itemPct === 100 || idx === sorted.length - 1) {
      pareto.push({ itemPct, hrsPct, itemCount: idx + 1, cumHours: Math.round(cumHrs) });
    }
  });

  // --- TBD Risk Breakdown ---
  const tbdByTypeMap = {};
  tbdItems.forEach(i => {
    if (!tbdByTypeMap[i.type_label]) tbdByTypeMap[i.type_label] = { label: i.type_label, count: 0, hours: 0 };
    tbdByTypeMap[i.type_label].count++;
    tbdByTypeMap[i.type_label].hours += i.grand_total_hours || 0;
  });
  const tbdByType = Object.values(tbdByTypeMap).sort((a, b) => b.hours - a.hours);

  // --- Complexity vs Type Heatmap ---
  const heatmap = {};
  const heatTypes = new Set();
  items.forEach(i => {
    const c = i.complexity || '0-TBD';
    const t = i.type_label;
    heatTypes.add(t);
    if (!heatmap[c]) heatmap[c] = {};
    if (!heatmap[c][t]) heatmap[c][t] = { count: 0, hours: 0 };
    heatmap[c][t].count++;
    heatmap[c][t].hours += i.grand_total_hours || 0;
  });
  const heatmapData = {
    complexities: complexOrder.filter(c => heatmap[c]),
    types: [...heatTypes].sort(),
    cells: heatmap
  };

  // --- Team Workload (by role) ---
  const funcRoleMap = {};
  const techRoleMap = {};
  items.forEach(i => {
    const fr = i.func_role || 'Unassigned';
    const tr = i.tech_role || 'Unassigned';
    if (!funcRoleMap[fr]) funcRoleMap[fr] = { label: fr, count: 0, hours: 0 };
    funcRoleMap[fr].count++;
    funcRoleMap[fr].hours += i.total_func_hours || 0;
    if (!techRoleMap[tr]) techRoleMap[tr] = { label: tr, count: 0, hours: 0 };
    techRoleMap[tr].count++;
    techRoleMap[tr].hours += i.total_tech_hours || 0;
  });
  const byFuncRole = Object.values(funcRoleMap).filter(r => r.hours > 0).sort((a, b) => b.hours - a.hours);
  const byTechRole = Object.values(techRoleMap).filter(r => r.hours > 0).sort((a, b) => b.hours - a.hours);

  // --- Phase Distribution (from summary) ---
  const summary = buildSummary(db, pid);
  const phaseLabels = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];
  const phaseNames = ['PREP', 'FTS', 'DESIGN', 'BUILD', 'SIT/UAT', 'DEP', 'HYP'];
  const phaseData = phaseLabels.map((p, idx) => {
    let funcHrs = 0, techHrs = 0;
    (summary.funcByRole || []).forEach(r => { funcHrs += r[p] || 0; });
    const techSections = [summary.techDev, summary.techBi, summary.techMig].filter(Boolean);
    techSections.forEach(sec => {
      sec.forEach(r => { techHrs += r[p] || 0; });
    });
    return { phase: phaseNames[idx], func: Math.round(funcHrs), tech: Math.round(techHrs), total: Math.round(funcHrs + techHrs) };
  });

  res.json({
    project: { currency: project.currency, delivery_level: project.delivery_level },
    kpi: {
      totalItems,
      grandTotal: Math.round(grandTotal),
      totalFunc: Math.round(totalFunc),
      totalTech: Math.round(totalTech),
      tbdCount,
      tbdHours: Math.round(tbdHours),
      tbdPct: totalItems > 0 ? Math.round(tbdCount / totalItems * 100) : 0,
      cancelledCount,
      noClassification,
      totalBillable,
      totalCost
    },
    byType,
    bySheet,
    byComplexity,
    byStatus,
    byModule,
    top10,
    costBySheet,
    costComparison,
    pareto,
    tbdByType,
    heatmapData,
    byFuncRole,
    byTechRole,
    phaseData
  });
});

// GET control section data for project settings panel
router.get('/:projectId/control', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  res.json({
    phases: db.prepare('SELECT * FROM project_phases WHERE project_id = ?').get(pid),
    pgo: db.prepare('SELECT * FROM project_pgo WHERE project_id = ?').get(pid),
    contingency: db.prepare('SELECT * FROM project_contingency WHERE project_id = ?').get(pid),
    funcPhasePct: db.prepare('SELECT * FROM project_func_phase_pct WHERE project_id = ?').get(pid),
    factors: db.prepare('SELECT * FROM project_factors WHERE project_id = ?').get(pid),
  });
});

// PUT phases (weeks per phase)
router.put('/:projectId/control/phases', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const b = req.body;
  db.prepare(`UPDATE project_phases SET prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?
    WHERE project_id=?`).run(b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, pid);
  res.json({ ok: true });
});

// PUT PGO %
router.put('/:projectId/control/pgo', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const b = req.body;
  db.prepare(`UPDATE project_pgo SET prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?,
    lead_split=?, consultant_split=? WHERE project_id=?`)
    .run(b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, b.lead_split, b.consultant_split, pid);
  res.json({ ok: true });
});

// PUT contingency %
router.put('/:projectId/control/contingency', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const b = req.body;
  db.prepare(`UPDATE project_contingency SET prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?
    WHERE project_id=?`).run(b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, pid);
  res.json({ ok: true });
});

// PUT functional phase distribution %
router.put('/:projectId/control/func-phase-pct', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const b = req.body;
  db.prepare(`UPDATE project_func_phase_pct SET prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?,
    architect_pct=? WHERE project_id=?`)
    .run(b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, b.architect_pct, pid);
  res.json({ ok: true });
});

// PUT item-level factors (cont_func_pct, cont_tech_pct, sit_func_pct, sit_tech_pct)
// These drive per-item calculations — triggers full recalculation
router.put('/:projectId/control/factors', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const b = req.body;
  db.prepare(`UPDATE project_factors SET cont_func_pct=?, cont_tech_pct=?, sit_func_pct=?, sit_tech_pct=?
    WHERE project_id=?`).run(b.cont_func_pct, b.cont_tech_pct, b.sit_func_pct, b.sit_tech_pct, pid);

  // Recalculate all items since these factors affect per-item calculations
  const nonTotal = db.prepare("SELECT id FROM items WHERE project_id = ? AND classification != 'TOTAL' ORDER BY id").all(pid);
  for (const it of nonTotal) calculateItem(db, it.id);
  const totals = db.prepare("SELECT id FROM items WHERE project_id = ? AND classification = 'TOTAL' ORDER BY id").all(pid);
  for (const it of totals) calculateItem(db, it.id);

  res.json({ ok: true, recalculated: nonTotal.length + totals.length });
});

// GET scope items + config for FUNCTIONAL tab
router.get('/:projectId/scope', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const items = db.prepare('SELECT * FROM project_scope_items WHERE project_id = ? ORDER BY id').all(pid);
  const config = db.prepare('SELECT * FROM project_scope_config WHERE project_id = ?').get(pid)
    || { low_hours: 24, medium_hours: 48, high_hours: 72, kdd_hours: 40, ip_hours: -40, complexity_multiplier: 1 };

  items.forEach(si => {
    si.total_hours = ((si.low_count * config.low_hours) + (si.medium_count * config.medium_hours) +
      (si.high_count * config.high_hours) + si.very_high_hours +
      si.localization_hours + (si.kdd_count * config.kdd_hours) +
      (si.ip_count * config.ip_hours)) * config.complexity_multiplier;
    si.total_hours = Math.round(si.total_hours * 10) / 10;
  });

  res.json({ items, config });
});

// GET per-sheet control data (func pct + fixed roles)
router.get('/:projectId/sheet-control/:sheetCode', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const code = req.params.sheetCode;
  const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
  res.json({
    funcPct: db.prepare('SELECT * FROM project_sheet_func_pct WHERE project_id=? AND sheet_type_code=?').get(pid, code),
    fixedRoles: db.prepare('SELECT * FROM project_fixed_roles WHERE project_id=? AND team=? ORDER BY id').all(pid, teamMap[code] || code)
  });
});

// PUT per-sheet func pct
router.put('/:projectId/sheet-control/:sheetCode/func-pct', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE project_sheet_func_pct SET prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?
    WHERE project_id=? AND sheet_type_code=?`)
    .run(b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, req.params.projectId, req.params.sheetCode);
  res.json({ ok: true });
});

// PUT a fixed role
router.put('/:projectId/fixed-role/:roleId', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE project_fixed_roles SET role_name=?, prep=?, fts=?, design=?, build=?, sit_uat=?, dep=?, hyp=?
    WHERE id=? AND project_id=?`)
    .run(b.role_name, b.prep||0, b.fts||0, b.design||0, b.build||0, b.sit_uat||0, b.dep||0, b.hyp||0,
      req.params.roleId, req.params.projectId);
  res.json({ ok: true });
});

// PUT scope config (baseline hours) — must be before :scopeId route
router.put('/:projectId/scope-config', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE project_scope_config SET low_hours=?, medium_hours=?, high_hours=?,
    kdd_hours=?, ip_hours=?, complexity_multiplier=? WHERE project_id=?`)
    .run(b.low_hours, b.medium_hours, b.high_hours, b.kdd_hours, b.ip_hours, b.complexity_multiplier, req.params.projectId);
  res.json({ ok: true });
});

// PUT a single scope item
router.put('/:projectId/scope/:scopeId', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE project_scope_items SET func_role=?, lob=?, low_count=?, medium_count=?,
    high_count=?, very_high_hours=?, localization_hours=?, kdd_count=?, ip_count=?
    WHERE id=? AND project_id=?`)
    .run(b.func_role, b.lob, b.low_count || 0, b.medium_count || 0,
      b.high_count || 0, b.very_high_hours || 0, b.localization_hours || 0,
      b.kdd_count || 0, b.ip_count || 0,
      req.params.scopeId, req.params.projectId);
  res.json({ ok: true });
});

// POST add new scope item
router.post('/:projectId/scope', (req, res) => {
  const db = getDb();
  const b = req.body;
  const r = db.prepare(`INSERT INTO project_scope_items
    (project_id, func_role, lob, low_count, medium_count, high_count, very_high_hours, localization_hours, kdd_count, ip_count)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.params.projectId, b.func_role || '', b.lob || '', 0, 0, 0, 0, 0, 0, 0);
  res.json({ id: r.lastInsertRowid });
});

// DELETE scope item
router.delete('/:projectId/scope/:scopeId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_scope_items WHERE id=? AND project_id=?')
    .run(req.params.scopeId, req.params.projectId);
  res.json({ ok: true });
});

// GET staffing explosion (Purple Grid) for a sheet team
router.get('/:projectId/staffing/:team', (req, res) => {
  const db = getDb();
  const pid = req.params.projectId;
  const team = req.params.team;
  const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
  const dbTeam = teamMap[team] || team;

  const phases = db.prepare('SELECT * FROM project_phases WHERE project_id = ?').get(pid);
  if (!phases) return res.json({ weeks: [], fixedRoles: [], developers: [] });

  const fixedRoles = db.prepare('SELECT * FROM project_fixed_roles WHERE project_id = ? AND team = ? ORDER BY id').all(pid, dbTeam);
  const profiles = db.prepare('SELECT * FROM project_staffing_profiles WHERE project_id = ? AND team = ? ORDER BY developer_role, sort_order').all(pid, dbTeam);

  const summary = buildSummary(db, pid);
  const techSection = dbTeam === 'DEV' ? summary.techDev : dbTeam === 'BI' ? summary.techBi : summary.techMig;

  const phaseOrder = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];
  const phaseLabels = ['PREP', 'FTS', 'DESIGN', 'BUILD', 'SIT/UAT', 'DEP', 'HYP'];

  // Build weekly columns: phase label + week number
  const weekCols = [];
  phaseOrder.forEach((p, idx) => {
    const numWeeks = phases[p] || 0;
    for (let w = 1; w <= numWeeks; w++) {
      weekCols.push({ phase: phaseLabels[idx], week: weekCols.length + 1, phaseWeek: w });
    }
  });

  // Fixed roles: hours/week per phase spread across weeks
  const fixedRows = fixedRoles.map(fr => {
    const hours = [];
    phaseOrder.forEach(p => {
      const numWeeks = phases[p] || 0;
      const hpw = fr[p] || 0;
      // If < 1 it's a percentage (for dep/hyp) - compute from subtotal
      let weeklyHrs;
      if (hpw > 0 && hpw < 1) {
        const subtotal = ['prep','fts','design','build','sit_uat'].reduce((s, ph) => s + (fr[ph] || 0) * (phases[ph] || 0), 0);
        weeklyHrs = numWeeks > 0 ? Math.round(subtotal * hpw / numWeeks * 10) / 10 : 0;
      } else {
        weeklyHrs = hpw;
      }
      for (let w = 0; w < numWeeks; w++) hours.push(weeklyHrs);
    });
    return { role: fr.role_name, type: 'fixed', hours };
  });

  // Developer roles: get total hours per phase from tech section, split by staffing profiles
  const devRoleMap = {};
  techSection.forEach(row => {
    if (row.role.startsWith('(')) devRoleMap[row.role] = row;
  });

  const devRows = [];
  const groupedProfiles = {};
  profiles.forEach(p => {
    if (!groupedProfiles[p.developer_role]) groupedProfiles[p.developer_role] = [];
    groupedProfiles[p.developer_role].push(p);
  });

  for (const [role, profs] of Object.entries(groupedProfiles)) {
    const techRow = devRoleMap[role];
    if (!techRow) continue;

    for (const prof of profs) {
      const hours = [];
      phaseOrder.forEach(p => {
        const numWeeks = phases[p] || 0;
        const phaseTotal = (techRow[p] || 0) * prof.split_pct;
        const hpw = numWeeks > 0 ? Math.round(phaseTotal / numWeeks) : 0;
        for (let w = 0; w < numWeeks; w++) hours.push(hpw);
      });

      devRows.push({
        type: prof.resource_type,
        pct: prof.split_pct,
        description: prof.description,
        numResources: prof.num_resources,
        role: prof.developer_role,
        workItem: prof.work_item,
        resourceOrg: prof.resource_org,
        activityType: prof.activity_type,
        projectRole: prof.project_role,
        hours
      });
    }
  }

  res.json({ weekCols, fixedRoles: fixedRows, developers: devRows });
});

// GET/PUT staffing profiles
router.get('/:projectId/staffing-profiles/:team', (req, res) => {
  const db = getDb();
  const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
  const dbTeam = teamMap[req.params.team] || req.params.team;
  res.json(db.prepare('SELECT * FROM project_staffing_profiles WHERE project_id = ? AND team = ? ORDER BY developer_role, sort_order')
    .all(req.params.projectId, dbTeam));
});

router.put('/:projectId/staffing-profiles/:profileId', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE project_staffing_profiles SET resource_type=?, split_pct=?, description=?,
    work_item=?, resource_org=?, activity_type=?, project_role=?, num_resources=?
    WHERE id=? AND project_id=?`)
    .run(b.resource_type, b.split_pct, b.description, b.work_item, b.resource_org,
      b.activity_type, b.project_role, b.num_resources || 1,
      req.params.profileId, req.params.projectId);
  res.json({ ok: true });
});

module.exports = router;
