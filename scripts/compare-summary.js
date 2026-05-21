const { getDb, initDb } = require('../server/db/connection');
const { buildSummary } = require('../server/services/summary-aggregator');
initDb();
const db = getDb();
const s = buildSummary(db, 1);

const P = ['prep','fts','design','build','sit_uat','dep','hyp','total'];

console.log('=== FUNCTIONAL ROLES (App vs Excel) ===');
const excel = {
  'Chief/Solution ARCHITECT': { prep:59.2, fts:59.2, design:78.1, build:321.5, sit_uat:151.5, dep:34.6, hyp:54.5, total:758.7 },
  'FI Analyst': { prep:235.0, fts:235.0, design:213.3, build:824.2, sit_uat:489.6, dep:113.2, hyp:185.4, total:2295.6 },
  'LE Analyst': { prep:23.8, fts:23.8, design:15.8, build:49.7, sit_uat:39.7, dep:9.9, hyp:14.4, total:177.1 },
  'MD Analyst': { prep:0, fts:0, design:33.0, build:271.7, sit_uat:90.6, dep:12.6, hyp:36.0, total:443.9 },
  'OTC Analyst': { prep:101.0, fts:101.0, design:170.4, build:599.3, sit_uat:243.4, dep:59.5, hyp:112.2, total:1386.7 },
  'PTP Analyst': { prep:53.5, fts:53.5, design:105.2, build:433.5, sit_uat:169.9, dep:37.3, hyp:75.4, total:928.3 },
  'PP Analyst': { prep:50.2, fts:50.2, design:48.6, build:152.3, sit_uat:90.8, dep:23.3, hyp:36.4, total:451.7 },
  'PS Analyst': { prep:75.2, fts:75.2, design:123.6, build:465.2, sit_uat:193.1, dep:45.3, hyp:85.6, total:1063.3 },
};

for (const row of [s.funcArchitect, ...s.funcByRole]) {
  const ex = excel[row.role];
  if (!ex) { console.log(row.role + ': no Excel data'); continue; }
  const diffs = [];
  for (const p of P) {
    const d = Math.abs((row[p]||0) - (ex[p]||0));
    if (d > 1.0) diffs.push(p + ':' + row[p] + ' vs ' + ex[p] + ' (d' + d.toFixed(1) + ')');
  }
  console.log(row.role + ': ' + (diffs.length === 0 ? 'MATCH' : diffs.join(', ')));
}

console.log('\n=== TECH DEV ===');
const exTech = {
  'Architect TSA': { total: 240 },
  'Technical Lead - DEV': { total: 748 },
  '(D) Abap Developer': { build: 454, sit_uat: 54.5, dep: 15, hyp: 52, total: 575.5 },
  '(D) CPI Developer': { build: 1447, sit_uat: 173.6, dep: 49, hyp: 167, total: 1836.6 },
  '(D) SAP Build Developer': { build: 161, sit_uat: 19.3, dep: 5, hyp: 19, total: 204.3 },
};
for (const row of s.techDev) {
  const ex = exTech[row.role];
  if (!ex) { console.log(row.role + ': no Excel ref'); continue; }
  const d = Math.abs((row.total||0) - (ex.total||0));
  console.log(row.role + ': total=' + row.total + ' (Excel=' + ex.total + ', d=' + d.toFixed(1) + ')' + (d <= 1 ? ' OK' : ' DIFF'));
}

console.log('\n=== TECH BI ===');
for (const row of s.techBi) {
  console.log(row.role + ': ' + JSON.stringify(row));
}

console.log('\n=== PGO ===');
const exPgo = { prep:160.4, fts:172.4, design:207.2, build:1288.3, sit_uat:410.6, dep:92.9, hyp:156.3, total:2488.0 };
const pgoDiffs = [];
for (const p of P) {
  const d = Math.abs((s.pgo[p]||0) - (exPgo[p]||0));
  if (d > 1) pgoDiffs.push(p + ':' + s.pgo[p] + ' vs ' + exPgo[p]);
}
console.log('PGO: ' + (pgoDiffs.length === 0 ? 'MATCH' : pgoDiffs.join(', ')));
console.log('PGO total: ' + s.pgo.total + ' (Excel: ' + exPgo.total + ')');
