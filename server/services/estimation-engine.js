const { getPool } = require('../db/connection');

async function calculateItem(pool, itemId) {
  const item = (await pool.query('SELECT * FROM items WHERE id = $1', [itemId])).rows[0];
  if (!item) return null;

  const project = (await pool.query('SELECT config_version_id FROM projects WHERE id = $1', [item.project_id])).rows[0];
  const vid = (project && project.config_version_id) || 1;

  const zeroOut = async () => {
    await pool.query(`
      UPDATE items SET blended_multiplier=0, sub_items_func=0, sub_items_tech=0,
        build_func=0, build_tech=0, sit_func=0, sit_tech=0,
        total_func_hours=0, total_tech_hours=0, grand_total_hours=0,
        updated_at=NOW() WHERE id=$1
    `, [itemId]);
    return null;
  };

  if (item.classification === 'TOTAL') {
    return calculateTotalRow(pool, item);
  }

  if (!item.classification || item.complexity === '0-TBD') return zeroOut();

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

  const grid = (await pool.query(
    'SELECT * FROM estimation_grid WHERE version_id = $1 AND UPPER(frice) = UPPER($2) AND UPPER(classification) = UPPER($3) AND complexity = $4',
    [vid, frice, classif, item.complexity]
  )).rows[0];

  if (!grid) return zeroOut();

  let teamPrefix = '(D)';
  if (item.tech_role) {
    const match = item.tech_role.match(/^\(([A-Z])\)/);
    if (match) teamPrefix = `(${match[1]})`;
  }

  const config = (await pool.query(
    'SELECT id FROM blended_rate_configs WHERE version_id = $1 AND team_prefix = $2',
    [vid, teamPrefix]
  )).rows[0];

  let multiplier = 1.0;
  if (config) {
    const ebc = (await pool.query(
      'SELECT multiplier FROM blended_effort_by_complexity WHERE config_id = $1 AND complexity = $2',
      [config.id, item.complexity]
    )).rows[0];
    if (ebc) multiplier = ebc.multiplier;
  }

  const factors = (await pool.query(
    'SELECT * FROM project_factors WHERE project_id = $1',
    [item.project_id]
  )).rows[0];

  const contFuncPct = factors ? factors.cont_func_pct : 0;
  const contTechPct = factors ? factors.cont_tech_pct : 0.15;
  const sitFuncPct = factors ? factors.sit_func_pct : 0.10;
  const sitTechPct = factors ? factors.sit_tech_pct : 0.12;

  const funcAdj = item.func_effort_adj != null ? item.func_effort_adj : 1;
  const techAdj = item.tech_effort_adj != null ? item.tech_effort_adj : 1;

  let subFunc, subTech, buildFunc, buildTech, sitFunc, sitTech;

  if (isSubItemType) {
    subFunc = Math.round(funcAdj * grid.total_func * (1 + contFuncPct));
    subTech = Math.round(techAdj * multiplier * grid.total_tech * (1 + contTechPct));
    buildFunc = 0;
    buildTech = 0;

    if (isMigration) {
      if (item.classification === 'Migration / Mock Load QA') {
        sitFunc = subFunc;
        sitTech = subTech;
      } else {
        sitFunc = 0;
        sitTech = 0;
      }
    } else {
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

  await pool.query(`
    UPDATE items SET
      blended_multiplier = $1,
      sub_items_func = $2, sub_items_tech = $3,
      build_func = $4, build_tech = $5,
      sit_func = $6, sit_tech = $7,
      total_func_hours = $8, total_tech_hours = $9,
      grand_total_hours = $10,
      updated_at = NOW()
    WHERE id = $11
  `, [
    Math.round(multiplier * 100) / 100,
    r(subFunc), r(subTech),
    buildFunc, buildTech,
    sitFunc, sitTech,
    r(totalFunc), r(totalTech),
    r(grandTotal),
    itemId
  ]);

  return { subFunc, subTech, buildFunc, buildTech, sitFunc, sitTech, totalFunc, totalTech, grandTotal, multiplier };
}

async function calculateTotalRow(pool, item) {
  const typeCode = item.object_type ? item.object_type.charAt(0) : '';
  const isMigration = typeCode === 'M';

  let buildFunc = 0, buildTech = 0, sitFunc = 0, sitTech = 0;

  if (isMigration) {
    const devSub = (await pool.query(`
      SELECT SUM(sub_items_func) AS sf, SUM(sub_items_tech) AS st
      FROM items
      WHERE project_id = $1 AND ricef_number = $2 AND classification = 'Migration / Development'
    `, [item.project_id, item.ricef_number])).rows[0];
    buildFunc = Math.round(devSub.sf || 0);
    buildTech = Math.round(devSub.st || 0);
    sitFunc = 0;
    sitTech = 0;
  } else {
    const subItems = (await pool.query(`
      SELECT SUM(sub_items_func) AS sf, SUM(sub_items_tech) AS st,
             SUM(sit_func) AS sitf, SUM(sit_tech) AS sitt
      FROM items
      WHERE project_id = $1 AND ricef_number = $2 AND classification != 'TOTAL'
    `, [item.project_id, item.ricef_number])).rows[0];

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

  await pool.query(`
    UPDATE items SET
      build_func = $1, build_tech = $2,
      sit_func = $3, sit_tech = $4,
      total_func_hours = $5, total_tech_hours = $6,
      grand_total_hours = $7,
      updated_at = NOW()
    WHERE id = $8
  `, [
    buildFunc, buildTech,
    sitFunc, sitTech,
    r(totalFunc), r(totalTech),
    r(grandTotal),
    item.id
  ]);

  return { buildFunc, buildTech, sitFunc, sitTech, totalFunc, totalTech, grandTotal };
}

module.exports = { calculateItem };
