const { Router } = require('express');
const { getPool } = require('../db/connection');
const { buildSummary } = require('../services/summary-aggregator');
const { calculateItem } = require('../services/estimation-engine');
const router = Router();

router.get('/:projectId/summary', async (req, res, next) => {
  try {
    const pool = getPool();
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.projectId])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const summary = await buildSummary(pool, req.params.projectId);
    res.json(summary);
  } catch (e) {
    next(e);
  }
});

// GET summary as PDF
router.get('/:projectId/summary-pdf', async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const pool = getPool();
    const pid = req.params.projectId;
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const summary = await buildSummary(pool, pid);
    const P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];
    const PL = ['PREP', 'FTS', 'DESIGN', 'BUILD', 'SIT/UAT', 'DEP', 'HYP'];

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 30, left: 30, right: 30 }, bufferPages: true });
    const filename = `${project.project_number}_Summary.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const left = 30;
    const pageW = doc.page.width - 60;
    const pageBottom = doc.page.height - 40;
    const s = (v) => v != null ? String(v) : '';
    const n = (v) => v != null ? String(Math.round(v * 10) / 10) : '0';
    const nc = (v) => v != null ? Math.round(v).toLocaleString() : '0';

    function checkPage(y, need) {
      if (y + need > pageBottom) { doc.addPage(); return 30; }
      return y;
    }

    function sectionTitle(y, text) {
      y = checkPage(y, 25);
      doc.save();
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0854a0');
      doc.text(text, left, y, { lineBreak: false, height: 14 });
      doc.moveTo(left, y + 14).lineTo(left + pageW, y + 14).lineWidth(0.5).strokeColor('#0854a0').stroke();
      doc.restore();
      return y + 18;
    }

    function phaseTable(y, rows, opts) {
      opts = opts || {};
      const roleLabelW = opts.labelWidth || 150;
      const totalW = 55;
      const phaseW = Math.floor((pageW - roleLabelW - totalW) / 7);
      const hdrH = 13;
      const rowH = 12;

      y = checkPage(y, hdrH + rowH * rows.length + 4);

      // Header
      doc.save();
      doc.rect(left, y, pageW, hdrH).fill('#0854a0');
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#fff');
      doc.text(opts.headerLabel || 'Role', left + 3, y + 3, { width: roleLabelW - 6, height: hdrH, lineBreak: false });
      PL.forEach((p, i) => {
        doc.text(p, left + roleLabelW + i * phaseW, y + 3, { width: phaseW, align: 'center', height: hdrH, lineBreak: false });
      });
      doc.text('TOTAL', left + roleLabelW + 7 * phaseW, y + 3, { width: totalW, align: 'right', height: hdrH, lineBreak: false });
      doc.restore();
      y += hdrH;

      // Rows
      rows.forEach((row, idx) => {
        y = checkPage(y, rowH);
        doc.save();
        const bg = row._highlight ? '#e8f0fe' : idx % 2 === 0 ? '#fff' : '#fafafa';
        doc.rect(left, y, pageW, rowH).fill(bg);
        doc.rect(left, y + rowH - 0.5, pageW, 0.5).fill('#e0e0e0');

        const fontName = row._highlight ? 'Helvetica-Bold' : 'Helvetica';
        doc.fontSize(6.5).font(fontName).fillColor('#333');
        doc.text(s(row.role), left + 3, y + 2.5, { width: roleLabelW - 6, height: rowH, lineBreak: false });
        P.forEach((p, i) => {
          doc.text(n(row[p]), left + roleLabelW + i * phaseW, y + 2.5, { width: phaseW, align: 'center', height: rowH, lineBreak: false });
        });
        const tot = row.total != null ? row.total : P.reduce((sum, p) => sum + (row[p] || 0), 0);
        doc.font('Helvetica-Bold').text(n(tot), left + roleLabelW + 7 * phaseW, y + 2.5, { width: totalW, align: 'right', height: rowH, lineBreak: false });
        doc.restore();
        y += rowH;
      });

      return y + 4;
    }

    function kvTable(y, items) {
      y = checkPage(y, 14 * items.length + 4);
      items.forEach((kv, idx) => {
        y = checkPage(y, 13);
        doc.save();
        const bg = idx % 2 === 0 ? '#fff' : '#fafafa';
        doc.rect(left, y, pageW, 12).fill(bg);
        doc.rect(left, y + 11.5, pageW, 0.5).fill('#e0e0e0');
        doc.fontSize(7).font('Helvetica').fillColor('#555');
        doc.text(kv.label, left + 3, y + 2.5, { width: 200, height: 12, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor('#333');
        doc.text(kv.value, left + 210, y + 2.5, { width: pageW - 213, height: 12, lineBreak: false });
        doc.restore();
        y += 12;
      });
      return y + 4;
    }

    // === HEADER ===
    doc.save();
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0854a0');
    doc.text(`${project.description} — Summary`, left, 30, { lineBreak: false, height: 20 });
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    doc.text(`Project ${s(project.project_number)} | ${project.currency} | Level ${project.delivery_level} | ${summary.itemCount} items | ${new Date().toISOString().slice(0, 10)}`, left, 50, { lineBreak: false, height: 12 });
    doc.restore();
    let y = 68;

    // === KPI ROW ===
    y = sectionTitle(y, 'Overview');
    y = kvTable(y, [
      { label: 'Total Functional Hours', value: nc(summary.totalFunc) + 'h' },
      { label: 'Total Technical Hours', value: nc(summary.totalTech) + 'h' },
      { label: 'Total PGO Hours', value: nc(summary.totalPgo) + 'h' },
      { label: 'Grand Total', value: nc(summary.totalGrand) + 'h' },
      { label: 'Item Count', value: String(summary.itemCount) }
    ]);

    // === FUNCTIONAL SCOPE EFFORT ===
    if (summary.funcScopeEffort && summary.funcScopeEffort.length > 0) {
      y = sectionTitle(y, 'Functional Scope — Functional Effort');
      y = phaseTable(y, summary.funcScopeEffort);
    }

    // === TECHNICAL SCOPE EFFORT ===
    if (summary.techScopeEffort && summary.techScopeEffort.length > 0) {
      y = sectionTitle(y, 'Technical Scope — Functional Effort');
      y = phaseTable(y, summary.techScopeEffort);
    }

    // === TOTAL FUNCTIONAL BY ROLE ===
    if (summary.funcByRole && summary.funcByRole.length > 0) {
      y = sectionTitle(y, 'Total — Functional Effort');
      const archRow = summary.funcArchitect || {};
      archRow._highlight = true;
      y = phaseTable(y, [archRow, ...summary.funcByRole]);
    }

    // === TECH DEV ===
    if (summary.techDev && summary.techDev.length > 0) {
      y = sectionTitle(y, 'Technical — DEV');
      y = phaseTable(y, summary.techDev, { labelWidth: 180 });
    }

    // === TECH BI ===
    if (summary.techBi && summary.techBi.length > 0) {
      y = sectionTitle(y, 'Technical — BI');
      y = phaseTable(y, summary.techBi, { labelWidth: 180 });
    }

    // === TECH MIGRATION ===
    if (summary.techMig && summary.techMig.length > 0) {
      y = sectionTitle(y, 'Technical — Migration');
      y = phaseTable(y, summary.techMig, { labelWidth: 180 });
    }

    // === PGO ===
    if (summary.pgo) {
      y = sectionTitle(y, 'PGO (Project Governance & Oversight)');
      const pgo = summary.pgo;
      pgo.role = 'PGO';
      pgo._highlight = true;
      y = phaseTable(y, [pgo]);
    }

    // === BLENDED RATES ===
    const blendedSections = [
      { key: 'devBlended', label: 'Blended Rate — DEV' },
      { key: 'biBlended', label: 'Blended Rate — BI' },
      { key: 'migBlended', label: 'Blended Rate — Migration' }
    ];
    blendedSections.forEach(sec => {
      const info = summary[sec.key];
      if (info) {
        y = sectionTitle(y, sec.label);
        y = kvTable(y, [
          { label: 'Team', value: info.team },
          { label: 'Delivery Level', value: info.level },
          { label: 'Billable Rate', value: info.currency + ' ' + nc(info.billable_rate) },
          { label: 'Effort Multiplier', value: String(info.effort_multiplier) },
          { label: 'Blended Cost', value: info.currency + ' ' + nc(info.blended_cost) },
          { label: 'Margin %', value: info.margin_pct + '%' }
        ]);
      }
    });

    // === PAGE NUMBERS ===
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.fontSize(6).font('Helvetica').fillColor('#999');
      doc.text(`Page ${i + 1} of ${pageCount}`, left, doc.page.height - 25, { width: pageW, align: 'center', height: 10, lineBreak: false });
      doc.restore();
    }

    doc.end();
  } catch (e) {
    next(e);
  }
});

// GET analytics data for project dashboard
router.get('/:projectId/analytics', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const items = (await pool.query(`
      SELECT i.*, rt.label as type_label, rt.code as type_code, rt.sheet_type_code
      FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
      WHERE i.project_id = $1 AND i.seq_number > 0
    `, [pid])).rows;

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
    const vid = project.config_version_id || 1;
    const teamPrefixMap = { RICEF: '(D)', BI: '(B)', MIGRATION: '(M)' };
    const rates = {};
    for (const prefix of ['(D)', '(B)', '(M)']) {
      const cfg = (await pool.query('SELECT id FROM blended_rate_configs WHERE version_id = $1 AND team_prefix = $2', [vid, prefix])).rows[0];
      if (!cfg) continue;
      const levels = (await pool.query('SELECT * FROM blended_delivery_levels WHERE config_id = $1 ORDER BY level_number', [cfg.id])).rows;
      rates[prefix] = {};
      for (const lvl of levels) {
        const rate = (await pool.query('SELECT * FROM blended_rates WHERE level_id = $1 AND currency = $2', [lvl.id, project.currency])).rows[0];
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
      const lvlLabel = (await pool.query(
        `SELECT bdl.level_label FROM blended_delivery_levels bdl
         JOIN blended_rate_configs brc ON bdl.config_id = brc.id
         WHERE brc.version_id = $1 AND brc.team_prefix = '(D)' AND bdl.level_number = $2`,
        [vid, lvl]
      )).rows[0];
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
    const typeToSheet = {};
    items.forEach(i => { typeToSheet[i.type_label] = i.sheet_type_code; });
    const heatmapData = {
      complexities: complexOrder.filter(c => heatmap[c]),
      types: [...heatTypes].sort(),
      cells: heatmap,
      typeToSheet
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
    const summaryData = await buildSummary(pool, pid);
    const phaseLabels = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];
    const phaseNames = ['PREP', 'FTS', 'DESIGN', 'BUILD', 'SIT/UAT', 'DEP', 'HYP'];
    const phaseData = phaseLabels.map((p, idx) => {
      let funcHrs = 0, techHrs = 0;
      (summaryData.funcByRole || []).forEach(r => { funcHrs += r[p] || 0; });
      const techSections = [summaryData.techDev, summaryData.techBi, summaryData.techMig].filter(Boolean);
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
  } catch (e) {
    next(e);
  }
});

// GET Orange Grid data for a specific sheet tab
router.get('/:projectId/orange-grid/:sheetType', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const sheet = req.params.sheetType;
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const summary = await buildSummary(pool, pid);
    const phases = (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [pid])).rows[0];

    const techMap = { RICEF: summary.techDev, BI: summary.techBi, MIGRATION: summary.techMig };
    const funcRows = (summary.sheetFunc && summary.sheetFunc[sheet]) || [];
    const techRows = techMap[sheet] || [];

    res.json({
      project: {
        delivery_level: project.delivery_level,
        currency: project.currency
      },
      phases,
      funcRows,
      techRows
    });
  } catch (e) {
    next(e);
  }
});

// GET Blue Grid data for a specific sheet tab (CUSTOMER team items)
router.get('/:projectId/blue-grid/:sheetType', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const sheet = req.params.sheetType;
    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const phases = (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [pid])).rows[0];
    const funcPct = (await pool.query("SELECT * FROM project_sheet_func_pct WHERE project_id=$1 AND sheet_type_code=$2 AND grid_type='BLUE'", [pid, sheet])).rows[0];
    const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
    const fixedRoles = (await pool.query("SELECT * FROM project_fixed_roles WHERE project_id=$1 AND team=$2 AND grid_type='BLUE' ORDER BY id", [pid, teamMap[sheet] || sheet])).rows;

    const items = (await pool.query(`
      SELECT i.*, rt.sheet_type_code
      FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
      WHERE i.project_id = $1 AND i.status != 'Cancelled' AND i.classification != 'TOTAL'
        AND rt.sheet_type_code = $2
    `, [pid, sheet])).rows;

    const pct = funcPct || {};
    const P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];

    // FUNC rows: aggregate by func_role where func_team = 'CUSTOMER'
    const funcRoleData = {};
    for (const item of items) {
      if (item.func_team !== 'CUSTOMER') continue;
      const fr = item.func_role || 'Unassigned';
      if (!funcRoleData[fr]) funcRoleData[fr] = { base: 0, sit: 0 };
      funcRoleData[fr].base += (item.build_func || 0) + (item.sub_items_func || 0);
      funcRoleData[fr].sit += (item.sit_func || 0);
    }

    const funcRows = [];
    for (const [role, data] of Object.entries(funcRoleData)) {
      const row = { role };
      const designPct = pct.design || 0;
      const buildPct = pct.build || 0;
      const depPct = pct.dep || 0;
      const hypPct = pct.hyp || 0;
      row.design = Math.round(data.base * designPct);
      row.build = Math.round(data.base * buildPct);
      row.sit_uat = Math.round(data.sit);
      row.dep = Math.round((row.design + row.build + row.sit_uat) * depPct);
      row.hyp = Math.round((row.design + row.build + row.sit_uat + row.dep) * hypPct);
      row.prep = 0; row.fts = 0;
      row.total = P.reduce((s, p) => s + (row[p] || 0), 0);
      if (row.total > 0) funcRows.push(row);
    }

    // TECH rows: fixed roles (hours/week x weeks) + developer roles (tech_team = 'CUSTOMER')
    const techRows = [];
    for (const fr of fixedRoles) {
      const row = { role: fr.role_name, _highlight: true };
      P.forEach(p => {
        if (p === 'dep' || p === 'hyp') {
          const sumBefore = P.slice(0, P.indexOf(p)).reduce((s, k) => s + (row[k] || 0), 0);
          row[p] = Math.round(sumBefore * (fr[p] || 0));
        } else {
          row[p] = Math.round((fr[p] || 0) * (phases[p] || 0));
        }
      });
      row.total = P.reduce((s, p) => s + (row[p] || 0), 0);
      techRows.push(row);
    }

    const techRoleData = {};
    for (const item of items) {
      if (item.tech_team !== 'CUSTOMER') continue;
      const tr = item.tech_role || 'Unassigned';
      if (!techRoleData[tr]) techRoleData[tr] = { build: 0, sit: 0 };
      techRoleData[tr].build += (item.build_tech || 0) + (item.sub_items_tech || 0);
      techRoleData[tr].sit += (item.sit_tech || 0);
    }

    for (const [role, data] of Object.entries(techRoleData)) {
      const row = { role };
      row.build = Math.round(data.build);
      row.sit_uat = Math.round(data.sit);
      row.prep = 0; row.fts = 0; row.design = 0;
      const depPct = pct.dep || 0;
      const hypPct = pct.hyp || 0;
      row.dep = Math.round((row.build + row.sit_uat) * depPct);
      row.hyp = Math.round((row.build + row.sit_uat + row.dep) * hypPct);
      row.total = P.reduce((s, p) => s + (row[p] || 0), 0);
      if (row.total > 0) techRows.push(row);
    }

    res.json({
      project: { delivery_level: project.delivery_level, currency: project.currency },
      phases,
      funcRows,
      techRows
    });
  } catch (e) {
    next(e);
  }
});

// GET control section data for project settings panel
router.get('/:projectId/control', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    res.json({
      phases: (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [pid])).rows[0],
      pgo: (await pool.query('SELECT * FROM project_pgo WHERE project_id = $1', [pid])).rows[0],
      contingency: (await pool.query('SELECT * FROM project_contingency WHERE project_id = $1', [pid])).rows[0],
      funcPhasePct: (await pool.query('SELECT * FROM project_func_phase_pct WHERE project_id = $1', [pid])).rows[0],
      factors: (await pool.query('SELECT * FROM project_factors WHERE project_id = $1', [pid])).rows[0],
    });
  } catch (e) {
    next(e);
  }
});

// PUT phases (weeks per phase)
router.put('/:projectId/control/phases', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const b = req.body;
    await pool.query(`UPDATE project_phases SET prep=$1, fts=$2, design=$3, build=$4, sit_uat=$5, dep=$6, hyp=$7
      WHERE project_id=$8`, [b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, pid]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT PGO %
router.put('/:projectId/control/pgo', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const b = req.body;
    await pool.query(`UPDATE project_pgo SET prep=$1, fts=$2, design=$3, build=$4, sit_uat=$5, dep=$6, hyp=$7,
      lead_split=$8, consultant_split=$9 WHERE project_id=$10`,
      [b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, b.lead_split, b.consultant_split, pid]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT contingency %
router.put('/:projectId/control/contingency', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const b = req.body;
    await pool.query(`UPDATE project_contingency SET prep=$1, fts=$2, design=$3, build=$4, sit_uat=$5, dep=$6, hyp=$7
      WHERE project_id=$8`, [b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, pid]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT functional phase distribution %
router.put('/:projectId/control/func-phase-pct', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const b = req.body;
    await pool.query(`UPDATE project_func_phase_pct SET prep=$1, fts=$2, design=$3, build=$4, sit_uat=$5, dep=$6, hyp=$7,
      architect_pct=$8, arch_prep=$9, arch_fts=$10, arch_design=$11, arch_build=$12, arch_sit_uat=$13, arch_dep=$14, arch_hyp=$15
      WHERE project_id=$16`,
      [b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, b.architect_pct,
        b.arch_prep, b.arch_fts, b.arch_design, b.arch_build, b.arch_sit_uat, b.arch_dep, b.arch_hyp, pid]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT item-level factors (cont_func_pct, cont_tech_pct, sit_func_pct, sit_tech_pct)
// These drive per-item calculations — triggers full recalculation
router.put('/:projectId/control/factors', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const b = req.body;
    await pool.query(`UPDATE project_factors SET cont_func_pct=$1, cont_tech_pct=$2, sit_func_pct=$3, sit_tech_pct=$4
      WHERE project_id=$5`, [b.cont_func_pct, b.cont_tech_pct, b.sit_func_pct, b.sit_tech_pct, pid]);

    // Recalculate all items since these factors affect per-item calculations
    const nonTotal = (await pool.query("SELECT id FROM items WHERE project_id = $1 AND classification != 'TOTAL' ORDER BY id", [pid])).rows;
    for (const it of nonTotal) await calculateItem(pool, it.id);
    const totals = (await pool.query("SELECT id FROM items WHERE project_id = $1 AND classification = 'TOTAL' ORDER BY id", [pid])).rows;
    for (const it of totals) await calculateItem(pool, it.id);

    res.json({ ok: true, recalculated: nonTotal.length + totals.length });
  } catch (e) {
    next(e);
  }
});

// GET scope items + config for FUNCTIONAL tab
router.get('/:projectId/scope', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const items = (await pool.query('SELECT * FROM project_scope_items WHERE project_id = $1 ORDER BY id', [pid])).rows;
    const config = (await pool.query('SELECT * FROM project_scope_config WHERE project_id = $1', [pid])).rows[0]
      || { low_hours: 24, medium_hours: 48, high_hours: 72, kdd_hours: 40, ip_hours: -40, complexity_multiplier: 1 };

    items.forEach(si => {
      si.total_hours = ((si.low_count * config.low_hours) + (si.medium_count * config.medium_hours) +
        (si.high_count * config.high_hours) + si.very_high_hours +
        si.localization_hours + (si.kdd_count * config.kdd_hours) +
        (si.ip_count * config.ip_hours)) * config.complexity_multiplier;
      si.total_hours = Math.round(si.total_hours * 10) / 10;
    });

    res.json({ items, config });
  } catch (e) {
    next(e);
  }
});

// GET per-sheet control data (func pct + fixed roles) — supports ?grid_type=ORANGE|BLUE
router.get('/:projectId/sheet-control/:sheetCode', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const code = req.params.sheetCode;
    const gridType = req.query.grid_type || 'ORANGE';
    const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
    res.json({
      funcPct: (await pool.query('SELECT * FROM project_sheet_func_pct WHERE project_id=$1 AND sheet_type_code=$2 AND grid_type=$3', [pid, code, gridType])).rows[0],
      fixedRoles: (await pool.query('SELECT * FROM project_fixed_roles WHERE project_id=$1 AND team=$2 AND grid_type=$3 ORDER BY id', [pid, teamMap[code] || code, gridType])).rows
    });
  } catch (e) {
    next(e);
  }
});

// PUT per-sheet func pct — supports ?grid_type=ORANGE|BLUE
router.put('/:projectId/sheet-control/:sheetCode/func-pct', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    const gridType = req.query.grid_type || 'ORANGE';
    await pool.query(`UPDATE project_sheet_func_pct SET prep=$1, fts=$2, design=$3, build=$4, sit_uat=$5, dep=$6, hyp=$7
      WHERE project_id=$8 AND sheet_type_code=$9 AND grid_type=$10`,
      [b.prep, b.fts, b.design, b.build, b.sit_uat, b.dep, b.hyp, req.params.projectId, req.params.sheetCode, gridType]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT a fixed role
router.put('/:projectId/fixed-role/:roleId', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(`UPDATE project_fixed_roles SET role_name=$1, prep=$2, fts=$3, design=$4, build=$5, sit_uat=$6, dep=$7, hyp=$8
      WHERE id=$9 AND project_id=$10`,
      [b.role_name, b.prep||0, b.fts||0, b.design||0, b.build||0, b.sit_uat||0, b.dep||0, b.hyp||0,
        req.params.roleId, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT scope config (baseline hours) — must be before :scopeId route
router.put('/:projectId/scope-config', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(`UPDATE project_scope_config SET low_hours=$1, medium_hours=$2, high_hours=$3,
      kdd_hours=$4, ip_hours=$5, complexity_multiplier=$6 WHERE project_id=$7`,
      [b.low_hours, b.medium_hours, b.high_hours, b.kdd_hours, b.ip_hours, b.complexity_multiplier, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUT a single scope item
router.put('/:projectId/scope/:scopeId', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(`UPDATE project_scope_items SET func_role=$1, lob=$2, low_count=$3, medium_count=$4,
      high_count=$5, very_high_hours=$6, localization_hours=$7, kdd_count=$8, ip_count=$9
      WHERE id=$10 AND project_id=$11`,
      [b.func_role, b.lob, b.low_count || 0, b.medium_count || 0,
        b.high_count || 0, b.very_high_hours || 0, b.localization_hours || 0,
        b.kdd_count || 0, b.ip_count || 0,
        req.params.scopeId, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST add new scope item
router.post('/:projectId/scope', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    const { rows } = await pool.query(`INSERT INTO project_scope_items
      (project_id, func_role, lob, low_count, medium_count, high_count, very_high_hours, localization_hours, kdd_count, ip_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.params.projectId, b.func_role || '', b.lob || '', 0, 0, 0, 0, 0, 0, 0]);
    res.json({ id: rows[0].id });
  } catch (e) {
    next(e);
  }
});

// DELETE scope item
router.delete('/:projectId/scope/:scopeId', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM project_scope_items WHERE id=$1 AND project_id=$2',
      [req.params.scopeId, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET staffing explosion (Purple Grid) for a sheet team
router.get('/:projectId/staffing/:team', async (req, res, next) => {
  try {
    const pool = getPool();
    const pid = req.params.projectId;
    const team = req.params.team;
    const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
    const dbTeam = teamMap[team] || team;

    const phases = (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [pid])).rows[0];
    if (!phases) return res.json({ weeks: [], fixedRoles: [], developers: [] });

    const fixedRoles = (await pool.query('SELECT * FROM project_fixed_roles WHERE project_id = $1 AND team = $2 ORDER BY id', [pid, dbTeam])).rows;
    const profiles = (await pool.query('SELECT * FROM project_staffing_profiles WHERE project_id = $1 AND team = $2 ORDER BY developer_role, sort_order', [pid, dbTeam])).rows;

    const summary = await buildSummary(pool, pid);
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
  } catch (e) {
    next(e);
  }
});

// GET/PUT staffing profiles
router.get('/:projectId/staffing-profiles/:team', async (req, res, next) => {
  try {
    const pool = getPool();
    const teamMap = { RICEF: 'DEV', BI: 'BI', MIGRATION: 'MIGRATION' };
    const dbTeam = teamMap[req.params.team] || req.params.team;
    res.json((await pool.query('SELECT * FROM project_staffing_profiles WHERE project_id = $1 AND team = $2 ORDER BY developer_role, sort_order',
      [req.params.projectId, dbTeam])).rows);
  } catch (e) {
    next(e);
  }
});

router.put('/:projectId/staffing-profiles/:profileId', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    await pool.query(`UPDATE project_staffing_profiles SET resource_type=$1, split_pct=$2, description=$3,
      work_item=$4, resource_org=$5, activity_type=$6, project_role=$7, num_resources=$8
      WHERE id=$9 AND project_id=$10`,
      [b.resource_type, b.split_pct, b.description, b.work_item, b.resource_org,
        b.activity_type, b.project_role, b.num_resources || 1,
        req.params.profileId, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
