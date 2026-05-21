const { getDb, initDb } = require('../server/db/connection');
const { buildSummary } = require('../server/services/summary-aggregator');
initDb();
const db = getDb();
const s = buildSummary(db, 1);

const exPhases = {
  PGO: { prep:160.4, fts:172.4, design:207.2, build:1288.3, sit_uat:410.6, dep:92.9, hyp:156.3, total:2488.0 },
  FUNCTIONAL: { prep:657.2, fts:657.2, design:866.1, build:3438.9, sit_uat:1600.3, dep:370.3, hyp:599.9, total:8189.9 },
  'TECHNICAL - DEV': { prep:36, fts:96, design:128, build:2454, sit_uat:467.4, dep:96, hyp:329, total:3604.4 },
  'TECHNICAL - BI': { prep:48, fts:48, design:40, build:870, sit_uat:116.9, dep:34, hyp:82, total:1238.9 },
  'TECHNICAL - MIG': { prep:120, fts:120, design:80, build:0, sit_uat:0, dep:0, hyp:32, total:352 },
};

const P = ['prep','fts','design','build','sit_uat','dep','hyp','total'];
for (const row of s.phases) {
  const ex = exPhases[row.role];
  if (!ex) { console.log(row.role + ': (no Excel ref)'); continue; }
  const diffs = [];
  for (const p of P) {
    const d = Math.abs((row[p]||0) - (ex[p]||0));
    if (d > 1) diffs.push(p + ':' + row[p] + ' vs ' + ex[p]);
  }
  console.log(row.role + ': ' + (diffs.length === 0 ? 'MATCH' : diffs.join(', ')));
}

// Show fixed role DEP values
console.log('\n=== DEV/BI/MIG sections DEP details ===');
for (const section of [s.techDev, s.techBi, s.techMig]) {
  for (const row of section) {
    if (row.dep > 0) console.log(row.role + ': DEP=' + row.dep);
  }
}
