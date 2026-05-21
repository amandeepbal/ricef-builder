const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { frice, classification, complexity } = req.query;
  let sql = 'SELECT * FROM estimation_grid WHERE 1=1';
  const params = [];
  if (frice) { sql += ' AND frice = ?'; params.push(frice); }
  if (classification) { sql += ' AND classification = ?'; params.push(classification); }
  if (complexity) { sql += ' AND complexity = ?'; params.push(complexity); }
  sql += ' ORDER BY frice, classification, complexity';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM estimation_grid WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const db = getDb();
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO estimation_grid (frice, classification, complexity, baseline,
      fs_bus_req, fs_f_analysis, fs_f_spec,
      dev_t_analysis, dev_t_spec, dev_coding, dev_tt_cases, dev_ut, dev_qa,
      fut_f_tcases, fut_test_data, fut_fut, brk_fix,
      total_func, total_tech, grand_total)
    VALUES (?,?,?,?, ?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?,?,?)
  `).run(
    b.frice, b.classification, b.complexity, b.baseline,
    b.fs_bus_req, b.fs_f_analysis, b.fs_f_spec,
    b.dev_t_analysis, b.dev_t_spec, b.dev_coding, b.dev_tt_cases, b.dev_ut, b.dev_qa,
    b.fut_f_tcases, b.fut_test_data, b.fut_fut, b.brk_fix,
    b.total_func, b.total_tech, b.grand_total
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const b = req.body;
    const numFields = ['baseline', 'fs_bus_req', 'fs_f_analysis', 'fs_f_spec',
      'dev_t_analysis', 'dev_t_spec', 'dev_coding', 'dev_tt_cases', 'dev_ut', 'dev_qa',
      'fut_f_tcases', 'fut_test_data', 'fut_fut', 'brk_fix',
      'total_func', 'total_tech', 'grand_total'];
    for (const f of numFields) {
      const n = parseFloat(b[f]);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ error: f + ' must be a valid number' });
      }
      b[f] = n;
    }
    db.prepare(`
      UPDATE estimation_grid SET frice=?, classification=?, complexity=?, baseline=?,
        fs_bus_req=?, fs_f_analysis=?, fs_f_spec=?,
        dev_t_analysis=?, dev_t_spec=?, dev_coding=?, dev_tt_cases=?, dev_ut=?, dev_qa=?,
        fut_f_tcases=?, fut_test_data=?, fut_fut=?, brk_fix=?,
        total_func=?, total_tech=?, grand_total=?
      WHERE id=?
    `).run(
      b.frice, b.classification, b.complexity, b.baseline,
      b.fs_bus_req, b.fs_f_analysis, b.fs_f_spec,
      b.dev_t_analysis, b.dev_t_spec, b.dev_coding, b.dev_tt_cases, b.dev_ut, b.dev_qa,
      b.fut_f_tcases, b.fut_test_data, b.fut_fut, b.brk_fix,
      b.total_func, b.total_tech, b.grand_total,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM estimation_grid WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/factors/all', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM estimation_factors ORDER BY id').all());
});

router.put('/factors/:id', (req, res) => {
  const db = getDb();
  const { calc_factor } = req.body;
  db.prepare('UPDATE estimation_factors SET calc_factor = ? WHERE id = ?')
    .run(calc_factor, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
