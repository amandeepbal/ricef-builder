const { getDb, initDb } = require('../server/db/connection');
const { calculateItem } = require('../server/services/estimation-engine');

initDb();
const db = getDb();

const openpyxl = null; // We'll parse via a child process since openpyxl is Python

const { execSync } = require('child_process');

const XLSM = __dirname + '/../Estimator tool_v7_Tarkett Canada Discovery Phase 1.xlsm';

const raw = execSync(`python3 << 'PYEOF'
import openpyxl, json

wb = openpyxl.load_workbook("${XLSM}", read_only=True, data_only=True)

items = []

for sheet_name in ['RICEF', 'BI', 'MIGRATION']:
    ws = wb[sheet_name]
    for row in ws.iter_rows(min_row=52, max_row=500, values_only=False):
        a_val = row[0].value  # col A - Project
        if a_val is None:
            continue
        # Skip control/header rows
        h_val = row[7].value  # col H - Seq #
        j_val = row[9].value  # col J - RICEF #
        t_val = row[19].value # col T - Object Type
        if h_val is None or j_val is None:
            continue
        if str(j_val).startswith('-') and str(j_val).endswith(')'):
            continue

        item = {
            'sheet': sheet_name,
            'project': row[0].value,
            'backlog': row[1].value,
            'arch_ref': row[2].value,
            'tsa_group': row[3].value,
            'tsa_process': row[4].value,
            'special_notes': row[5].value,
            'predecessor': row[6].value,
            'seq': row[7].value,
            'module': row[8].value,
            'ricef_number': row[9].value,
            'description': row[10].value,
            'design_notes': row[11].value,
            'status': row[12].value,
            'func_adj': row[13].value,
            'func_team': row[14].value,
            'func_role': row[15].value,
            'tech_adj': row[16].value,
            'tech_team': row[17].value,
            'tech_role': row[18].value,
            'object_type': row[19].value,
            'classification': row[20].value,
            'complexity': row[21].value,
        }
        items.append(item)

wb.close()
print(json.dumps(items))
PYEOF`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const items = JSON.parse(raw.trim());
console.log(`Parsed ${items.length} items from Excel`);

const project = db.prepare(
  `INSERT INTO projects (project_number, description, currency, delivery_level)
   VALUES (?, ?, ?, ?)`
).run('TARKETT-D1', 'Tarkett Canada - Discovery Phase 1', 'CAD', 1);

const projectId = project.lastInsertRowid;
db.prepare('INSERT INTO project_factors (project_id) VALUES (?)').run(projectId);

console.log(`Created project id=${projectId}`);

const ricefTypes = db.prepare('SELECT * FROM ricef_types').all();
const typeMap = {};
ricefTypes.forEach(t => {
  typeMap[t.label] = t;
  typeMap[t.code + ' - ' + t.label] = t;
  typeMap[t.full_label] = t;
});

const insertItem = db.prepare(`
  INSERT INTO items (project_id, ricef_type_id, backlog_number, architecture_ref,
    tsa_group, tsa_process, special_notes, predecessor, seq_number, module,
    ricef_number, description, design_notes, status,
    func_effort_adj, func_team, func_role,
    tech_effort_adj, tech_team, tech_role,
    object_type, classification, complexity)
  VALUES (?,?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?, ?,?,?)
`);

let imported = 0;
let skipped = 0;

const txn = db.transaction(() => {
  for (const item of items) {
    const objType = item.object_type;
    const rt = typeMap[objType];
    if (!rt) {
      console.log(`  SKIP: unknown type "${objType}" for ${item.ricef_number}`);
      skipped++;
      continue;
    }

    const seq = parseInt(item.seq) || (rt.seq_from + imported);

    try {
      const result = insertItem.run(
        projectId, rt.id,
        item.backlog || null, item.arch_ref || null,
        item.tsa_group || null, item.tsa_process || null,
        item.special_notes || null, item.predecessor || null,
        seq, item.module || null,
        item.ricef_number || `${item.module || 'XX'}-${rt.code}-${String(seq).padStart(4,'0')}`,
        item.description || null, item.design_notes || null,
        item.status || 'New',
        item.func_adj || 1, item.func_team || 'SYNTAX', item.func_role || null,
        item.tech_adj || 1, item.tech_team || 'SYNTAX', item.tech_role || null,
        objType, item.classification || null, item.complexity || '0-TBD'
      );

      calculateItem(db, result.lastInsertRowid);
      imported++;
    } catch (e) {
      console.log(`  ERR: ${item.ricef_number}: ${e.message}`);
      skipped++;
    }
  }
});

txn();

console.log(`\nImported: ${imported}, Skipped: ${skipped}`);

// Import project control section data
console.log('\nImporting control section data...');

// Project phases (weeks per phase)
db.prepare(`INSERT INTO project_phases (project_id, prep, fts, design, build, sit_uat, dep, hyp)
  VALUES (?, 6, 6, 4, 14, 10, 1, 4)`).run(projectId);

// Functional phase distribution %
db.prepare(`INSERT INTO project_func_phase_pct (project_id, prep, fts, design, build, sit_uat, dep, hyp, architect_pct)
  VALUES (?, 0.15, 0.15, 0.10, 0.30, 0.24, 0.06, 0.10, 0.10)`).run(projectId);

// PGO %
db.prepare(`INSERT INTO project_pgo (project_id, prep, fts, design, build, sit_uat, dep, hyp, lead_split, consultant_split)
  VALUES (?, 0.20, 0.20, 0.20, 0.20, 0.20, 0.20, 0.15, 0.23, 0.80)`).run(projectId);

// Contingency %
db.prepare(`INSERT INTO project_contingency (project_id, prep, fts, design, build, sit_uat, dep, hyp)
  VALUES (?, 0.10, 0.10, 0.10, 0.15, 0.15, 0.15, 0)`).run(projectId);

// Fixed role hours per phase (from control sections)
const insertFixed = db.prepare(
  `INSERT INTO project_fixed_roles (project_id, team, role_name, prep, fts, design, build, sit_uat, dep, hyp)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
);
// DEV team (from RICEF sheet rows 7-8, DEP=0.03, HYP=0.1 are %)
insertFixed.run(projectId, 'DEV', 'Architect TSA',          4, 8, 16, 4, 2, 0.03, 0.1);
insertFixed.run(projectId, 'DEV', 'Technical Lead - DEV',   2, 8, 16, 24, 20, 0.03, 0.1);
// BI team (from BI sheet rows 7-8)
insertFixed.run(projectId, 'BI',  'Architect BI',           8, 8, 2, 0, 0, 0.03, 0);
insertFixed.run(projectId, 'BI',  'Technical Lead - BI',    0, 0, 8, 12, 2, 0.03, 0);
// MIGRATION team (from MIGRATION sheet rows 7-8)
insertFixed.run(projectId, 'MIGRATION', 'Architect MIGRATION',          0, 0, 0, 0, 0, 0, 0);
insertFixed.run(projectId, 'MIGRATION', 'Technical Lead - MIGRATION',  20,20,20, 0, 0, 0.15, 0.1);

// Per-sheet FUNC phase distribution %
const insertSheetFuncPct = db.prepare(
  `INSERT INTO project_sheet_func_pct (project_id, sheet_type_code, prep, fts, design, build, sit_uat, dep, hyp)
   VALUES (?,?,?,?,?,?,?,?,?)`
);
insertSheetFuncPct.run(projectId, 'RICEF',     0, 0, 0.25, 0.75, 0, 0.03, 0.10);
insertSheetFuncPct.run(projectId, 'BI',         0, 0, 0.25, 0.75, 0, 0.03, 0.10);
insertSheetFuncPct.run(projectId, 'MIGRATION',  0, 0, 0,    0.75, 0.25, 0, 0.10);

// Scope item config
db.prepare(`INSERT INTO project_scope_config (project_id, low_hours, medium_hours, high_hours, kdd_hours, ip_hours, complexity_multiplier)
  VALUES (?, 24, 48, 72, 40, -40, 1)`).run(projectId);

// Scope items from FUNCTIONAL sheet (rows 29-37)
const insertScope = db.prepare(
  `INSERT INTO project_scope_items (project_id, func_role, lob, low_count, medium_count, high_count, very_high_hours, localization_hours, kdd_count, ip_count)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
);
insertScope.run(projectId, 'FI Analyst',  'Finance',                     19, 14, 3, 40, 0, 1, 0);
insertScope.run(projectId, 'OTC Analyst', 'Sales',                       12,  6, 0, 36, 0, 0, 0);
insertScope.run(projectId, 'PTP Analyst', 'Sourcing and Procurement',     4,  4, 0, 36, 0, 0, 0);
insertScope.run(projectId, 'PP Analyst',  'Manufacturing',                4,  2, 1,  0, 0, 1, 0);
insertScope.run(projectId, 'PS Analyst',  'Professional Services',        6,  5, 1,  0, 0, 0, 0);
insertScope.run(projectId, 'LE Analyst',  'Supply Chain',                 4,  1, 0,  0, 0, 0, 0);
insertScope.run(projectId, 'MD Analyst',  'Database and Data Mngt',       0,  0, 0,  0, 0, 0, 0);

console.log('Control section data imported.');

const summary = db.prepare(`
  SELECT COUNT(*) as count,
    ROUND(SUM(total_func_hours),1) as func,
    ROUND(SUM(total_tech_hours),1) as tech,
    ROUND(SUM(grand_total_hours),1) as total
  FROM items WHERE project_id = ?
`).get(projectId);

console.log(`Project totals: ${summary.count} items, FUNC=${summary.func}h, TECH=${summary.tech}h, TOTAL=${summary.total}h`);
