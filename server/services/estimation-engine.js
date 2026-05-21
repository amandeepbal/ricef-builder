function calculateItem(db, itemId) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return null;

  const zeroOut = () => {
    db.prepare(`
      UPDATE items SET blended_multiplier=0, sub_items_func=0, sub_items_tech=0,
        build_func=0, build_tech=0, sit_func=0, sit_tech=0,
        total_func_hours=0, total_tech_hours=0, grand_total_hours=0,
        updated_at=datetime('now') WHERE id=?
    `).run(itemId);
    return null;
  };

  if (item.classification === 'TOTAL') {
    return calculateTotalRow(db, item);
  }

  if (!item.classification || item.complexity === '0-TBD') return zeroOut();

  // Types B, H, D, M use SUB Items path (not BUILD)
  const typeCode = item.object_type ? item.object_type.charAt(0) : '';
  const isSubItemType = ['B', 'H', 'D', 'M'].includes(typeCode);
  const isMigration = typeCode === 'M';

  const slashPos = item.classification.indexOf(' / ');
  let frice, classif;
  if (slashPos > 0) {
    frice = item.classification.substring(0, slashPos);
    classif = item.classification.substring(slashPos + 3);
  } else {
    frice = item.classification;
    classif = item.classification;
  }

  const grid = db.prepare(
    'SELECT * FROM estimation_grid WHERE UPPER(frice) = UPPER(?) AND UPPER(classification) = UPPER(?) AND complexity = ?'
  ).get(frice, classif, item.complexity);

  if (!grid) return zeroOut();

  let teamPrefix = '(D)';
  if (item.tech_role) {
    const match = item.tech_role.match(/^\(([A-Z])\)/);
    if (match) teamPrefix = `(${match[1]})`;
  }

  const config = db.prepare(
    'SELECT id FROM blended_rate_configs WHERE team_prefix = ?'
  ).get(teamPrefix);

  let multiplier = 1.0;
  if (config) {
    const ebc = db.prepare(
      'SELECT multiplier FROM blended_effort_by_complexity WHERE config_id = ? AND complexity = ?'
    ).get(config.id, item.complexity);
    if (ebc) multiplier = ebc.multiplier;
  }

  const factors = db.prepare(
    'SELECT * FROM project_factors WHERE project_id = ?'
  ).get(item.project_id);

  const contFuncPct = factors ? factors.cont_func_pct : 0;
  const contTechPct = factors ? factors.cont_tech_pct : 0.15;
  const sitFuncPct = factors ? factors.sit_func_pct : 0.10;
  const sitTechPct = factors ? factors.sit_tech_pct : 0.12;

  const funcAdj = item.func_effort_adj != null ? item.func_effort_adj : 1;
  const techAdj = item.tech_effort_adj != null ? item.tech_effort_adj : 1;

  let subFunc, subTech, buildFunc, buildTech, sitFunc, sitTech;

  if (isSubItemType) {
    // B/H/D/M types: effort goes to SUB Items columns, BUILD is empty
    subFunc = Math.round(funcAdj * grid.total_func * (1 + contFuncPct));
    subTech = Math.round(techAdj * multiplier * grid.total_tech * (1 + contTechPct));
    buildFunc = 0;
    buildTech = 0;

    if (isMigration) {
      // MIGRATION: SIT only for "Mock Load QA" items; equals sub_items values
      if (item.classification === 'Migration / Mock Load QA') {
        sitFunc = subFunc;
        sitTech = subTech;
      } else {
        sitFunc = 0;
        sitTech = 0;
      }
    } else {
      // B/H/D: SIT = SUB × (1+cont) × sit_pct
      sitFunc = Math.round(subFunc * (1 + contFuncPct) * sitFuncPct * 10) / 10;
      sitTech = Math.round(subTech * (1 + contTechPct) * sitTechPct * 100) / 100;
    }
  } else {
    subFunc = 0;
    subTech = 0;
    buildFunc = Math.round(funcAdj * (1 + contFuncPct) * grid.total_func);
    buildTech = Math.round(techAdj * multiplier * (1 + contTechPct) * grid.total_tech);
    sitFunc = Math.round(buildFunc * sitFuncPct * 10) / 10;
    sitTech = Math.round(buildTech * sitTechPct * 100) / 100;
  }

  const totalFunc = (buildFunc || 0) + (subFunc || 0) + sitFunc;
  const totalTech = (buildTech || 0) + (subTech || 0) + sitTech;
  const grandTotal = totalFunc + totalTech;

  const r = (v) => Math.round(v * 10) / 10;

  db.prepare(`
    UPDATE items SET
      blended_multiplier = ?,
      sub_items_func = ?, sub_items_tech = ?,
      build_func = ?, build_tech = ?,
      sit_func = ?, sit_tech = ?,
      total_func_hours = ?, total_tech_hours = ?,
      grand_total_hours = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    Math.round(multiplier * 100) / 100,
    r(subFunc), r(subTech),
    buildFunc, buildTech,
    sitFunc, sitTech,
    r(totalFunc), r(totalTech),
    r(grandTotal),
    itemId
  );

  return { subFunc, subTech, buildFunc, buildTech, sitFunc, sitTech, totalFunc, totalTech, grandTotal, multiplier };
}

function calculateTotalRow(db, item) {
  const typeCode = item.object_type ? item.object_type.charAt(0) : '';
  const isMigration = typeCode === 'M';

  let buildFunc = 0, buildTech = 0, sitFunc = 0, sitTech = 0;

  if (isMigration) {
    // MIGRATION TOTAL: build = SUM of "Development" sub-items only
    const devSub = db.prepare(`
      SELECT SUM(sub_items_func) AS sf, SUM(sub_items_tech) AS st
      FROM items
      WHERE project_id = ? AND ricef_number = ? AND classification = 'Migration / Development'
    `).get(item.project_id, item.ricef_number);
    buildFunc = Math.round(devSub.sf || 0);
    buildTech = Math.round(devSub.st || 0);

    // SIT is not summed on TOTAL for migration (it's empty in Excel)
    sitFunc = 0;
    sitTech = 0;
  } else {
    // B/H/D TOTAL: sum all sub-items
    const subItems = db.prepare(`
      SELECT SUM(sub_items_func) AS sf, SUM(sub_items_tech) AS st,
             SUM(sit_func) AS sitf, SUM(sit_tech) AS sitt
      FROM items
      WHERE project_id = ? AND ricef_number = ? AND classification != 'TOTAL'
    `).get(item.project_id, item.ricef_number);

    if (subItems && (subItems.sf || subItems.st)) {
      buildFunc = Math.round(subItems.sf || 0);
      buildTech = Math.round(subItems.st || 0);
      sitFunc = Math.round((subItems.sitf || 0) * 10) / 10;
      sitTech = Math.round((subItems.sitt || 0) * 100) / 100;
    }
  }

  const totalFunc = buildFunc + sitFunc;
  const totalTech = buildTech + sitTech;
  const grandTotal = totalFunc + totalTech;
  const r = (v) => Math.round(v * 10) / 10;

  db.prepare(`
    UPDATE items SET
      build_func = ?, build_tech = ?,
      sit_func = ?, sit_tech = ?,
      total_func_hours = ?, total_tech_hours = ?,
      grand_total_hours = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    buildFunc, buildTech,
    sitFunc, sitTech,
    r(totalFunc), r(totalTech),
    r(grandTotal),
    item.id
  );

  return { buildFunc, buildTech, sitFunc, sitTech, totalFunc, totalTech, grandTotal };
}

module.exports = { calculateItem };
