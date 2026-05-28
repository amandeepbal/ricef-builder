const { Router } = require('express');
const { getPool } = require('../db/connection');
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const vid = req.query.version_id || 1;
    const { frice, classification, complexity } = req.query;
    let sql = 'SELECT * FROM estimation_grid WHERE version_id = $1';
    const params = [vid];
    let idx = 2;
    if (frice) { sql += ' AND frice = $' + idx++; params.push(frice); }
    if (classification) { sql += ' AND classification = $' + idx++; params.push(classification); }
    if (complexity) { sql += ' AND complexity = $' + idx++; params.push(complexity); }
    sql += ' ORDER BY frice, classification, complexity';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM estimation_grid WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const b = req.body;
    const { rows } = await pool.query(`
      INSERT INTO estimation_grid (version_id, frice, classification, complexity, baseline,
        fs_bus_req, fs_f_analysis, fs_f_spec,
        dev_t_analysis, dev_t_spec, dev_coding, dev_tt_cases, dev_ut, dev_qa,
        fut_f_tcases, fut_test_data, fut_fut, brk_fix,
        total_func, total_tech, grand_total)
      VALUES ($1,$2,$3,$4,$5, $6,$7,$8, $9,$10,$11,$12,$13,$14, $15,$16,$17,$18, $19,$20,$21) RETURNING id
    `, [
      b.version_id || 1, b.frice, b.classification, b.complexity, b.baseline,
      b.fs_bus_req, b.fs_f_analysis, b.fs_f_spec,
      b.dev_t_analysis, b.dev_t_spec, b.dev_coding, b.dev_tt_cases, b.dev_ut, b.dev_qa,
      b.fut_f_tcases, b.fut_test_data, b.fut_fut, b.brk_fix,
      b.total_func, b.total_tech, b.grand_total
    ]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
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
    await pool.query(`
      UPDATE estimation_grid SET frice=$1, classification=$2, complexity=$3, baseline=$4,
        fs_bus_req=$5, fs_f_analysis=$6, fs_f_spec=$7,
        dev_t_analysis=$8, dev_t_spec=$9, dev_coding=$10, dev_tt_cases=$11, dev_ut=$12, dev_qa=$13,
        fut_f_tcases=$14, fut_test_data=$15, fut_fut=$16, brk_fix=$17,
        total_func=$18, total_tech=$19, grand_total=$20
      WHERE id=$21
    `, [
      b.frice, b.classification, b.complexity, b.baseline,
      b.fs_bus_req, b.fs_f_analysis, b.fs_f_spec,
      b.dev_t_analysis, b.dev_t_spec, b.dev_coding, b.dev_tt_cases, b.dev_ut, b.dev_qa,
      b.fut_f_tcases, b.fut_test_data, b.fut_fut, b.brk_fix,
      b.total_func, b.total_tech, b.grand_total,
      req.params.id
    ]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM estimation_grid WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/factors/all', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM estimation_factors ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

router.put('/factors/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { calc_factor } = req.body;
    await pool.query('UPDATE estimation_factors SET calc_factor = $1 WHERE id = $2',
      [calc_factor, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
