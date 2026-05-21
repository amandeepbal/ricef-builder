const { getDb, initDb } = require('../server/db/connection');
const { calculateItem } = require('../server/services/estimation-engine');
const { execSync } = require('child_process');

initDb();
const db = getDb();

const XLSM = __dirname + '/../Estimator tool_v7_Tarkett Canada Discovery Phase 1.xlsm';

// ============================================================
// Step 1: Update estimation grid values from v7 Excel
// ============================================================
console.log('=== Step 1: Updating estimation grid from v7 Excel ===');

const gridRaw = execSync(`python3 << 'PYEOF'
import openpyxl, json

wb = openpyxl.load_workbook("${XLSM}", data_only=True)
ws = wb['ESTIMATION_GRID']

rows = []
for r in range(7, 270):
    b = ws.cell(row=r, column=2).value   # FRICE
    c = ws.cell(row=r, column=3).value   # Classification
    d = ws.cell(row=r, column=4).value   # Complexity
    f = ws.cell(row=r, column=6).value   # BASELINE
    g = ws.cell(row=r, column=7).value   # FS bus req
    h = ws.cell(row=r, column=8).value   # FS f analysis
    i = ws.cell(row=r, column=9).value   # FS f spec
    j = ws.cell(row=r, column=10).value  # DEV t analysis
    k = ws.cell(row=r, column=11).value  # DEV t spec
    l = ws.cell(row=r, column=12).value  # DEV coding
    m = ws.cell(row=r, column=13).value  # DEV tt cases
    n = ws.cell(row=r, column=14).value  # DEV ut
    o = ws.cell(row=r, column=15).value  # DEV qa/sup
    p = ws.cell(row=r, column=16).value  # FUT f tcases
    q = ws.cell(row=r, column=17).value  # FUT test data
    s = ws.cell(row=r, column=18).value  # FUT fut
    t = ws.cell(row=r, column=19).value  # BRK fix
    u = ws.cell(row=r, column=21).value  # FUNC total
    v = ws.cell(row=r, column=22).value  # TECH total
    w = ws.cell(row=r, column=23).value  # Grand total

    if b and c and d and u is not None and not isinstance(u, str):
        rows.append({
            'frice': b, 'classification': c, 'complexity': d,
            'baseline': f if isinstance(f, (int, float)) else 0,
            'fs_bus_req': g or 0, 'fs_f_analysis': h or 0, 'fs_f_spec': i or 0,
            'dev_t_analysis': j or 0, 'dev_t_spec': k or 0, 'dev_coding': l or 0,
            'dev_tt_cases': m or 0, 'dev_ut': n or 0, 'dev_qa': o or 0,
            'fut_f_tcases': p or 0, 'fut_test_data': q or 0, 'fut_fut': s or 0,
            'brk_fix': t or 0,
            'total_func': round(u, 2) if u else 0,
            'total_tech': round(v, 2) if v else 0,
            'grand_total': round(w, 2) if w else 0
        })

print(json.dumps(rows))
wb.close()
PYEOF`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const gridRows = JSON.parse(gridRaw.trim());
console.log(`  Parsed ${gridRows.length} grid rows from v7 Excel`);

const updateGrid = db.prepare(`
  UPDATE estimation_grid SET baseline=?, fs_bus_req=?, fs_f_analysis=?, fs_f_spec=?,
    dev_t_analysis=?, dev_t_spec=?, dev_coding=?, dev_tt_cases=?, dev_ut=?, dev_qa=?,
    fut_f_tcases=?, fut_test_data=?, fut_fut=?, brk_fix=?,
    total_func=?, total_tech=?, grand_total=?
  WHERE frice=? AND classification=? AND complexity=?
`);

const insertGrid = db.prepare(`
  INSERT INTO estimation_grid (frice, classification, complexity, baseline,
    fs_bus_req, fs_f_analysis, fs_f_spec, dev_t_analysis, dev_t_spec, dev_coding,
    dev_tt_cases, dev_ut, dev_qa, fut_f_tcases, fut_test_data, fut_fut, brk_fix,
    total_func, total_tech, grand_total)
  VALUES (?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?)
`);

let gridUpdated = 0, gridInserted = 0;
const gridTxn = db.transaction(() => {
  for (const g of gridRows) {
    const existing = db.prepare(
      'SELECT id FROM estimation_grid WHERE frice=? AND classification=? AND complexity=?'
    ).get(g.frice, g.classification, g.complexity);

    if (existing) {
      updateGrid.run(
        g.baseline, g.fs_bus_req, g.fs_f_analysis, g.fs_f_spec,
        g.dev_t_analysis, g.dev_t_spec, g.dev_coding,
        g.dev_tt_cases, g.dev_ut, g.dev_qa,
        g.fut_f_tcases, g.fut_test_data, g.fut_fut, g.brk_fix,
        g.total_func, g.total_tech, g.grand_total,
        g.frice, g.classification, g.complexity
      );
      gridUpdated++;
    } else {
      insertGrid.run(
        g.frice, g.classification, g.complexity, g.baseline,
        g.fs_bus_req, g.fs_f_analysis, g.fs_f_spec,
        g.dev_t_analysis, g.dev_t_spec, g.dev_coding,
        g.dev_tt_cases, g.dev_ut, g.dev_qa,
        g.fut_f_tcases, g.fut_test_data, g.fut_fut, g.brk_fix,
        g.total_func, g.total_tech, g.grand_total
      );
      gridInserted++;
    }
  }
});
gridTxn();
console.log(`  Grid: ${gridUpdated} updated, ${gridInserted} inserted`);

// ============================================================
// Step 2: Delete existing Tarkett items and reimport with sub-items
// ============================================================
console.log('\n=== Step 2: Reimporting Tarkett items ===');

const project = db.prepare('SELECT * FROM projects WHERE project_number = ?').get('TARKETT-D1');
if (!project) {
  console.log('ERROR: TARKETT-D1 project not found');
  process.exit(1);
}
const projectId = project.id;

db.prepare('DELETE FROM items WHERE project_id = ?').run(projectId);
console.log('  Deleted existing items');

const itemsRaw = execSync(`python3 << 'PYEOF'
import openpyxl, json

wb = openpyxl.load_workbook("${XLSM}", data_only=True)

items = []

for sheet_name in ['RICEF', 'BI', 'MIGRATION']:
    ws = wb[sheet_name]
    for row in ws.iter_rows(min_row=52, max_row=500, values_only=False):
        a_val = row[0].value  # col A - Project
        if a_val is None:
            continue
        j_val = row[9].value  # col J - RICEF #
        t_val = row[19].value # col T - Object Type
        if j_val is None:
            continue
        if str(j_val).startswith('-') and str(j_val).endswith(')'):
            continue
        if '#REF' in str(j_val) or '#REF' in str(row[12].value or ''):
            continue
        if str(row[12].value or '') == '-':
            continue

        h_val = row[7].value  # col H - Seq #
        u_val = row[20].value # col U - Classification

        # Import BOTH parent (TOTAL) and sub-items
        # Sub-items have no Seq# but have a classification != TOTAL
        item = {
            'sheet': sheet_name,
            'project': row[0].value,
            'backlog': row[1].value,
            'arch_ref': row[2].value,
            'tsa_group': row[3].value,
            'tsa_process': row[4].value,
            'special_notes': row[5].value,
            'predecessor': row[6].value,
            'seq': h_val,
            'module': row[8].value,
            'ricef_number': j_val,
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
            'classification': u_val,
            'complexity': row[21].value,
            'is_sub_item': h_val is None and u_val != 'TOTAL',
        }
        items.append(item)

wb.close()
print(json.dumps(items))
PYEOF`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const items = JSON.parse(itemsRaw.trim());
console.log(`  Parsed ${items.length} items (incl sub-items) from Excel`);

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

let imported = 0, skipped = 0;

const importTxn = db.transaction(() => {
  for (const item of items) {
    const objType = item.object_type;
    const rt = typeMap[objType];
    if (!rt) {
      console.log(`  SKIP: unknown type "${objType}" for ${item.ricef_number}`);
      skipped++;
      continue;
    }

    const seq = parseInt(item.seq) || 0;

    // For tech_adj and func_adj: preserve 0 values (don't convert to 1)
    // null/undefined → use 1 as default; 0 → keep as 0
    const funcAdj = item.func_adj != null ? item.func_adj : 1;
    const techAdj = item.tech_adj != null ? item.tech_adj : 1;

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
        funcAdj, item.func_team || 'SYNTAX', item.func_role || null,
        techAdj, item.tech_team || 'SYNTAX', item.tech_role || null,
        objType, item.classification || null, item.complexity || '0-TBD'
      );

      calculateItem(db, result.lastInsertRowid);
      imported++;
    } catch (e) {
      console.log(`  ERR: ${item.ricef_number} (${item.classification}): ${e.message}`);
      skipped++;
    }
  }
});

importTxn();
console.log(`  Imported: ${imported}, Skipped: ${skipped}`);

// Recalculate all non-TOTAL items first, then TOTAL items
console.log('  Recalculating all items...');
const nonTotalItems = db.prepare(
  "SELECT id FROM items WHERE project_id = ? AND classification != 'TOTAL' ORDER BY id"
).all(projectId);
for (const it of nonTotalItems) calculateItem(db, it.id);
console.log(`  Recalculated ${nonTotalItems.length} non-TOTAL items`);

const totalItems = db.prepare(
  "SELECT id FROM items WHERE project_id = ? AND classification = 'TOTAL' ORDER BY id"
).all(projectId);
for (const it of totalItems) calculateItem(db, it.id);
console.log(`  Recalculated ${totalItems.length} TOTAL items`);

// ============================================================
// Step 3: Verify key values against Excel
// ============================================================
console.log('\n=== Step 3: Verification ===');

const summary = db.prepare(`
  SELECT COUNT(*) as count,
    ROUND(SUM(total_func_hours),1) as func,
    ROUND(SUM(total_tech_hours),1) as tech,
    ROUND(SUM(grand_total_hours),1) as total
  FROM items WHERE project_id = ? AND status != 'Cancelled' AND classification != 'TOTAL'
`).get(projectId);
console.log(`  Active items: ${summary.count}, FUNC=${summary.func}h, TECH=${summary.tech}h`);

// Check key values
const abapDev = db.prepare(`
  SELECT SUM(build_tech) as bt, SUM(sit_tech) as st
  FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
  WHERE i.project_id = ? AND i.tech_role LIKE '%Abap%'
    AND i.status != 'Cancelled' AND i.classification != 'TOTAL'
`).get(projectId);
console.log(`  (D) Abap Developer: BUILD=${abapDev.bt}, SIT=${Math.round(abapDev.st*100)/100} (Excel: BUILD=454, SIT=54.48)`);

const biDev = db.prepare(`
  SELECT SUM(build_tech) as bt, SUM(sit_tech) as st, SUM(sub_items_tech) as subt
  FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
  WHERE i.project_id = ? AND i.tech_role LIKE '%(B)%'
    AND i.status != 'Cancelled' AND i.classification != 'TOTAL'
`).get(projectId);
console.log(`  (B) BI Developer: SUB_TECH=${biDev.subt}, SIT=${biDev.st ? Math.round(biDev.st*100)/100 : 0} (Excel: BUILD=702, SIT=96.876)`);

// Check a CPI item
const cpiItem = db.prepare("SELECT build_func, build_tech, sit_func, sit_tech FROM items WHERE ricef_number='MD-I-0001' AND project_id=?").get(projectId);
console.log(`  MD-I-0001 (CPI/Mapping 2-Low): BF=${cpiItem.build_func} BT=${cpiItem.build_tech} SF=${cpiItem.sit_func} ST=${cpiItem.sit_tech} (Excel: BF=21 BT=48 SF=2.1 ST=5.76)`);

// Check Workflow item
const wfItem = db.prepare("SELECT build_func, build_tech, sit_func, sit_tech, tech_effort_adj FROM items WHERE ricef_number='PTP-W-4500' AND classification != 'TOTAL' AND project_id=?").get(projectId);
if (wfItem) console.log(`  PTP-W-4500 (Workflow 3-Med): BF=${wfItem.build_func} BT=${wfItem.build_tech} SF=${wfItem.sit_func} ST=${wfItem.sit_tech} techAdj=${wfItem.tech_effort_adj} (Excel: BF=29 BT=0 SF=2.9 ST=0)`);

// Check SAP Build item
const sapItem = db.prepare("SELECT build_func, build_tech, func_effort_adj, tech_effort_adj FROM items WHERE ricef_number='PTP-S-8100' AND project_id=?").get(projectId);
if (sapItem) console.log(`  PTP-S-8100 (Build/PA 4-High): BF=${sapItem.build_func} BT=${sapItem.build_tech} fAdj=${sapItem.func_effort_adj} tAdj=${sapItem.tech_effort_adj} (Excel: BF=74 BT=161)`);
