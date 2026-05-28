const P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];

async function buildSummary(pool, projectId) {
  const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [projectId])).rows[0];
  const phases = (await pool.query('SELECT * FROM project_phases WHERE project_id = $1', [projectId])).rows[0];
  const funcPhasePct = (await pool.query('SELECT * FROM project_func_phase_pct WHERE project_id = $1', [projectId])).rows[0]
    || { prep: 0.15, fts: 0.15, design: 0.10, build: 0.30, sit_uat: 0.24, dep: 0.06, hyp: 0.10, architect_pct: 0.10 };
  const pgoData = (await pool.query('SELECT * FROM project_pgo WHERE project_id = $1', [projectId])).rows[0]
    || { prep: 0.20, fts: 0.20, design: 0.20, build: 0.20, sit_uat: 0.20, dep: 0.20, hyp: 0.15, lead_split: 0.23, consultant_split: 0.80 };
  const cont = (await pool.query('SELECT * FROM project_contingency WHERE project_id = $1', [projectId])).rows[0]
    || { prep: 0.10, fts: 0.10, design: 0.10, build: 0.15, sit_uat: 0.15, dep: 0.15, hyp: 0 };
  const scopeConfig = (await pool.query('SELECT * FROM project_scope_config WHERE project_id = $1', [projectId])).rows[0]
    || { low_hours: 24, medium_hours: 48, high_hours: 72, kdd_hours: 40, ip_hours: -40, complexity_multiplier: 1 };
  const scopeItems = (await pool.query('SELECT * FROM project_scope_items WHERE project_id = $1', [projectId])).rows;
  const fixedRoles = (await pool.query('SELECT * FROM project_fixed_roles WHERE project_id = $1', [projectId])).rows;
  const sheetFuncPcts = (await pool.query('SELECT * FROM project_sheet_func_pct WHERE project_id = $1', [projectId])).rows;

  const sheetPctMap = {};
  sheetFuncPcts.forEach(s => sheetPctMap[s.sheet_type_code] = s);

  const funcScopeByRole = {};
  for (const si of scopeItems) {
    const hrs = ((si.low_count * scopeConfig.low_hours) + (si.medium_count * scopeConfig.medium_hours) +
                 (si.high_count * scopeConfig.high_hours) + si.very_high_hours +
                 si.localization_hours + (si.kdd_count * scopeConfig.kdd_hours) +
                 (si.ip_count * scopeConfig.ip_hours)) * scopeConfig.complexity_multiplier;
    if (hrs > 0) funcScopeByRole[si.func_role] = (funcScopeByRole[si.func_role] || 0) + hrs;
  }

  const items = (await pool.query(`
    SELECT i.*, rt.sheet_type_code FROM items i
    JOIN ricef_types rt ON i.ricef_type_id = rt.id
    WHERE i.project_id = $1 AND i.status != 'Cancelled' AND i.classification != 'TOTAL'
  `, [projectId])).rows;

  const sheetRoleData = {};
  const techDev = {}, techBi = {}, techMig = {};

  for (const item of items) {
    const fr = item.func_role || 'Unassigned';
    const tr = item.tech_role || 'Unassigned';
    const st = item.sheet_type_code || 'RICEF';

    if (!sheetRoleData[st]) sheetRoleData[st] = {};
    if (!sheetRoleData[st][fr]) sheetRoleData[st][fr] = { base: 0, sit: 0, mockQaSit: 0, cutover: 0 };

    if (st === 'MIGRATION') {
      const cls = item.classification || '';
      if (cls === 'Migration / Extraction' || cls === 'Migration / Cleansing' || cls === 'Migration / Development') {
        sheetRoleData[st][fr].base += (item.sub_items_func || 0);
      } else if (cls === 'Migration / Mock Load QA') {
        sheetRoleData[st][fr].mockQaSit += (item.sub_items_func || 0);
      } else if (cls === 'Migration / Cutover') {
        sheetRoleData[st][fr].cutover += (item.sub_items_func || 0);
      }
    } else {
      sheetRoleData[st][fr].base += (item.build_func || 0) + (item.sub_items_func || 0);
      sheetRoleData[st][fr].sit += (item.sit_func || 0);
    }

    if (st !== 'MIGRATION') {
      const techHrs = (item.build_tech || 0) + (item.sub_items_tech || 0);
      const sitTech = item.sit_tech || 0;
      const techMap = st === 'BI' ? techBi : techDev;
      if (!techMap[tr]) techMap[tr] = { build: 0, sit: 0 };
      techMap[tr].build += techHrs;
      techMap[tr].sit += sitTech;
    }
  }

  function computeSheetFunc(sheetCode) {
    const pct = sheetPctMap[sheetCode] || {};
    const roleData = sheetRoleData[sheetCode] || {};
    const result = {};

    for (const [role, data] of Object.entries(roleData)) {
      const row = {};

      if (sheetCode === 'MIGRATION') {
        row.prep = 0;
        row.fts = 0;
        row.design = 0;
        row.build = data.base * (pct.build || 0.75);
        row.sit_uat = data.base * (pct.sit_uat || 0.25) + (data.mockQaSit || 0);
        row.dep = data.cutover || 0;
        const running = row.build + row.sit_uat + row.dep;
        row.hyp = (pct.hyp || 0) > 0 ? Math.round(running * (pct.hyp || 0)) : 0;
      } else {
        let running = 0;
        P.forEach(p => {
          if (p === 'dep' || p === 'hyp') return;
          if (p === 'sit_uat') {
            row[p] = Math.round(data.sit);
          } else {
            row[p] = data.base * (pct[p] || 0);
          }
          running += row[p];
        });
        const depPct = pct.dep || 0;
        row.dep = depPct > 0 ? Math.round(running * depPct) : 0;
        running += row.dep;
        const hypPct = pct.hyp || 0;
        row.hyp = hypPct > 0 ? Math.round(running * hypPct) : 0;
      }

      row.total = P.reduce((s, p) => s + (row[p] || 0), 0);
      result[role] = row;
    }
    return result;
  }

  const ricefFunc = computeSheetFunc('RICEF');
  const biFunc = computeSheetFunc('BI');
  const migFunc = computeSheetFunc('MIGRATION');

  const allFuncRoles = new Set([
    ...Object.keys(funcScopeByRole),
    ...Object.keys(ricefFunc),
    ...Object.keys(biFunc),
    ...Object.keys(migFunc)
  ]);

  const roleOrder = ['ALL Analyst', 'Commerce Analyst', 'FI Analyst', 'CO Analyst',
    'LE Analyst', 'MD Analyst', 'OTC Analyst', 'PTP Analyst', 'PM Analyst',
    'PP Analyst', 'PS Analyst', 'EWM Analyst'];
  const orderedRoles = roleOrder.filter(r => allFuncRoles.has(r));
  allFuncRoles.forEach(r => { if (!orderedRoles.includes(r)) orderedRoles.push(r); });

  const funcScopeEffort = [];
  const techScopeEffort = [];

  for (const role of orderedRoles) {
    const scopeHrs = funcScopeByRole[role] || 0;
    if (scopeHrs > 0) {
      const sRow = { role };
      P.forEach(p => {
        sRow[p] = r(p === 'hyp' ? scopeHrs * (funcPhasePct.hyp || 0.10) : scopeHrs * (funcPhasePct[p] || 0));
      });
      sRow.total = r(P.reduce((s, p) => s + (sRow[p] || 0), 0));
      funcScopeEffort.push(sRow);
    }

    const ricef = ricefFunc[role] || {};
    const bi = biFunc[role] || {};
    const mig = migFunc[role] || {};
    const hasTech = P.some(p => (ricef[p] || 0) + (bi[p] || 0) + (mig[p] || 0) > 0);
    if (hasTech) {
      const tRow = { role };
      P.forEach(p => {
        tRow[p] = r((ricef[p] || 0) + (bi[p] || 0) + (mig[p] || 0));
      });
      tRow.total = r(P.reduce((s, p) => s + (tRow[p] || 0), 0));
      techScopeEffort.push(tRow);
    }
  }

  const funcByRole = [];
  let totalFuncHours = 0;

  for (const role of orderedRoles) {
    const row = { role };
    let rowTotal = 0;

    P.forEach(p => {
      const scopeHrs = funcScopeByRole[role] || 0;
      const scopePhase = p === 'hyp' ? scopeHrs * (funcPhasePct.hyp || 0.10) : scopeHrs * (funcPhasePct[p] || 0);

      const ricefPhase = (ricefFunc[role] || {})[p] || 0;
      const biPhase = (biFunc[role] || {})[p] || 0;
      const migPhase = (migFunc[role] || {})[p] || 0;

      const preContingency = scopePhase + ricefPhase + biPhase + migPhase;
      const withCont = preContingency * (1 + (cont[p] || 0));
      row[p] = r(withCont);
      rowTotal += withCont;
    });

    row.total = r(rowTotal);
    row.lead = r(rowTotal * pgoData.lead_split);
    row.consultant = r(rowTotal * pgoData.consultant_split);
    totalFuncHours += rowTotal;
    if (rowTotal !== 0) funcByRole.push(row);
  }

  const archPctMap = {
    prep: funcPhasePct.arch_prep != null ? funcPhasePct.arch_prep : (funcPhasePct.architect_pct || 0.10),
    fts: funcPhasePct.arch_fts != null ? funcPhasePct.arch_fts : (funcPhasePct.architect_pct || 0.10),
    design: funcPhasePct.arch_design != null ? funcPhasePct.arch_design : (funcPhasePct.architect_pct || 0.10),
    build: funcPhasePct.arch_build != null ? funcPhasePct.arch_build : (funcPhasePct.architect_pct || 0.10),
    sit_uat: funcPhasePct.arch_sit_uat != null ? funcPhasePct.arch_sit_uat : (funcPhasePct.architect_pct || 0.10),
    dep: funcPhasePct.arch_dep != null ? funcPhasePct.arch_dep : (funcPhasePct.architect_pct || 0.10),
    hyp: funcPhasePct.arch_hyp != null ? funcPhasePct.arch_hyp : (funcPhasePct.architect_pct || 0.10)
  };
  const archRow = { role: 'Chief/Solution ARCHITECT' };
  let archTotal = 0;
  P.forEach(p => {
    const phaseFunc = funcByRole.reduce((s, fr) => s + (fr[p] || 0), 0);
    const v = phaseFunc * (archPctMap[p] || 0.10) * (1 + (cont[p] || 0));
    archRow[p] = r(v);
    archTotal += v;
  });
  archRow.total = r(archTotal);
  totalFuncHours += archTotal;

  const devSection = buildTechSection(fixedRoles, 'DEV', techDev, phases);
  const biSection = buildTechSection(fixedRoles, 'BI', techBi, phases);
  const migSection = buildTechSection(fixedRoles, 'MIGRATION', techMig, phases);

  let totalTechHours = 0;
  [devSection, biSection, migSection].forEach(section =>
    section.forEach(row => { totalTechHours += row.total || 0; }));

  const pgoRow = { role: 'PGO' };
  let pgoTotal = 0;
  P.forEach(p => {
    const funcPhase = (archRow[p] || 0) + funcByRole.reduce((s, fr) => s + (fr[p] || 0), 0);
    const techPhase = [devSection, biSection, migSection].reduce((s, sec) => s + sumPhase(sec, p), 0);
    const v = (funcPhase + techPhase) * (pgoData[p] || 0);
    pgoRow[p] = r(v);
    pgoTotal += v;
  });
  pgoRow.total = r(pgoTotal);

  function objToRows(obj, roles) {
    const rows = [];
    for (const role of roles) {
      if (obj[role]) {
        const row = Object.assign({ role }, obj[role]);
        row.total = r(P.reduce((s, p) => s + (row[p] || 0), 0));
        rows.push(row);
      }
    }
    Object.keys(obj).forEach(role => {
      if (!roles.includes(role)) {
        const row = Object.assign({ role }, obj[role]);
        row.total = r(P.reduce((s, p) => s + (row[p] || 0), 0));
        rows.push(row);
      }
    });
    return rows;
  }

  const weeksRow = { role: '# of Weeks' };
  P.forEach(p => weeksRow[p] = (phases || {})[p] || 0);
  weeksRow.total = '';

  const funcSumRow = makePhaseSum('FUNCTIONAL', [archRow, ...funcByRole]);
  const devSumRow = makePhaseSum('TECHNICAL - DEV', devSection);
  const biSumRow = makePhaseSum('TECHNICAL - BI', biSection);
  const migSumRow = makePhaseSum('TECHNICAL - MIG', migSection);

  const grandRow = { role: 'GRAND TOTAL' };
  P.forEach(p => grandRow[p] = r((pgoRow[p]||0) + (funcSumRow[p]||0) + (devSumRow[p]||0) + (biSumRow[p]||0) + (migSumRow[p]||0)));
  grandRow.total = r((pgoRow.total||0) + (funcSumRow.total||0) + (devSumRow.total||0) + (biSumRow.total||0) + (migSumRow.total||0));

  return {
    project,
    phases: [weeksRow, pgoRow, funcSumRow, devSumRow, biSumRow, migSumRow, grandRow],
    itemCount: items.filter(i => i.seq_number > 0).length,
    totalFunc: r(totalFuncHours),
    totalTech: r(totalTechHours),
    totalPgo: r(pgoTotal),
    totalGrand: grandRow.total,
    pgo: pgoRow,
    funcScopeEffort,
    techScopeEffort,
    funcArchitect: archRow,
    funcByRole,
    sheetFunc: {
      RICEF: objToRows(ricefFunc, orderedRoles),
      BI: objToRows(biFunc, orderedRoles),
      MIGRATION: objToRows(migFunc, orderedRoles)
    },
    techDev: devSection,
    techBi: biSection,
    techMig: migSection,
    devBlended: await getBlendedInfo(pool, '(D)', project),
    biBlended: await getBlendedInfo(pool, '(B)', project),
    migBlended: await getBlendedInfo(pool, '(M)', project),
    leadSplit: pgoData.lead_split,
    consultantSplit: pgoData.consultant_split
  };
}

function buildTechSection(fixedRoles, team, devRoles, phases) {
  const rows = [];
  const numWeeks = phases || {};

  const devEntries = Object.entries(devRoles)
    .filter(([, v]) => v.build > 0 || v.sit > 0)
    .sort((a, b) => (b[1].build + b[1].sit) - (a[1].build + a[1].sit));

  let devBuildTotal = 0, devSitTotal = 0, devDepTotal = 0;
  const devRows = [];
  for (const [role, v] of devEntries) {
    const buildSit = v.build + v.sit;
    const dep = Math.round(buildSit * 0.03);
    const hyp = Math.round((buildSit + dep) * 0.10);
    devRows.push({
      role,
      prep: 0, fts: 0, design: 0,
      build: r(v.build), sit_uat: r(v.sit),
      dep: r(dep), hyp: r(hyp),
      total: r(v.build + v.sit + dep + hyp)
    });
    devBuildTotal += v.build;
    devSitTotal += v.sit;
    devDepTotal += dep;
  }

  const isMigTeam = team === 'MIGRATION';
  const fixed = fixedRoles.filter(r => r.team === team);
  for (const fr of fixed) {
    const row = { role: fr.role_name };
    let subtotal = 0;
    ['prep', 'fts', 'design', 'build', 'sit_uat'].forEach(p => {
      const val = fr[p] || 0;
      if (val > 0 && val < 1 && isMigTeam) {
        row[p] = 0;
      } else {
        const hrs = val * (numWeeks[p] || 1);
        row[p] = r(hrs);
      }
      subtotal += row[p];
    });

    let dep;
    if (fr.dep > 0 && fr.dep < 1) {
      dep = isMigTeam ? 0 : Math.round(subtotal * fr.dep);
    } else {
      dep = (fr.dep || 0) * (numWeeks.dep || 1);
    }
    row.dep = r(dep);

    const hypBase = subtotal + dep;
    const hyp = (fr.hyp > 0 && fr.hyp < 1) ? Math.round(hypBase * fr.hyp) : (fr.hyp || 0) * (numWeeks.hyp || 1);
    row.hyp = r(hyp);
    row.total = r(hypBase + hyp);
    rows.push(row);
  }

  rows.push(...devRows);
  return rows;
}

function makePhaseSum(label, rows) {
  const sum = { role: label };
  P.forEach(p => sum[p] = r(rows.reduce((s, row) => s + (row[p] || 0), 0)));
  sum.total = r(P.reduce((s, p) => s + (sum[p] || 0), 0));
  return sum;
}

function sumPhase(section, phase) {
  return section.reduce((sum, row) => sum + (row[phase] || 0), 0);
}

async function getBlendedInfo(pool, teamPrefix, project) {
  const vid = project.config_version_id || 1;
  const config = (await pool.query('SELECT * FROM blended_rate_configs WHERE version_id = $1 AND team_prefix = $2', [vid, teamPrefix])).rows[0];
  if (!config) return null;
  const level = (await pool.query('SELECT * FROM blended_delivery_levels WHERE config_id = $1 AND level_number = $2',
    [config.id, project.delivery_level || 1])).rows[0];
  if (!level) return null;
  const rates = (await pool.query('SELECT * FROM blended_rates WHERE level_id = $1 AND currency = $2',
    [level.id, project.currency || 'USD'])).rows[0];
  return {
    team: config.team_label, level: level.level_label, currency: project.currency || 'USD',
    billable_rate: rates ? rates.billable_rate : 0,
    effort_multiplier: rates ? rates.effort_multiplier : 0,
    blended_cost: rates ? rates.blended_cost : 0,
    margin_pct: rates ? Math.round(rates.margin_pct * 10000) / 100 : 0
  };
}

function r(v) { return Math.round((v || 0) * 10) / 10; }

module.exports = { buildSummary };
