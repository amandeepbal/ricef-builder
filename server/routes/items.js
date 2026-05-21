const { Router } = require('express');
const { getDb } = require('../db/connection');
const { calculateItem } = require('../services/estimation-engine');
const router = Router();

router.get('/:projectId/items', (req, res) => {
  const db = getDb();
  const { sheetType, ricefTypeId, status, module: mod, complexity, search } = req.query;

  let sql = `SELECT i.*, rt.code AS type_code, rt.label AS type_label,
                    rt.sheet_type_code
             FROM items i
             JOIN ricef_types rt ON i.ricef_type_id = rt.id
             WHERE i.project_id = ?`;
  const params = [req.params.projectId];

  if (sheetType) {
    sql += ' AND rt.sheet_type_code = ?';
    params.push(sheetType);
  }
  if (ricefTypeId) {
    sql += ' AND i.ricef_type_id = ?';
    params.push(ricefTypeId);
  }
  if (status) {
    sql += ' AND i.status = ?';
    params.push(status);
  }
  if (mod) {
    sql += ' AND i.module = ?';
    params.push(mod);
  }
  if (complexity) {
    sql += ' AND i.complexity = ?';
    params.push(complexity);
  }
  if (search) {
    sql += ' AND (i.description LIKE ? OR i.ricef_number LIKE ? OR i.special_notes LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY rt.sort_order, i.ricef_number, CASE WHEN i.classification = \'TOTAL\' THEN 0 ELSE 1 END, i.seq_number, i.id';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.is_sub_item = (r.seq_number === 0); });
  res.json(rows);
});

router.post('/:projectId/items', (req, res) => {
  const db = getDb();
  const projectId = req.params.projectId;
  const { ricef_type_id } = req.body;

  const ricefType = db.prepare('SELECT * FROM ricef_types WHERE id = ?').get(ricef_type_id);
  if (!ricefType) return res.status(400).json({ error: 'Invalid RICEF type' });

  const maxSeq = db.prepare(
    'SELECT MAX(seq_number) AS mx FROM items WHERE project_id = ? AND ricef_type_id = ?'
  ).get(projectId, ricef_type_id);

  const nextSeq = maxSeq.mx ? maxSeq.mx + 1 : ricefType.seq_from;
  const modulePrefix = req.body.module || 'XX';
  const ricefNumber = `${modulePrefix}-${ricefType.code}-${String(nextSeq).padStart(4, '0')}`;

  const result = db.prepare(`
    INSERT INTO items (project_id, ricef_type_id, seq_number, ricef_number, object_type,
      backlog_number, architecture_ref, tsa_group, tsa_process, special_notes,
      predecessor, module, description, design_notes, status,
      func_effort_adj, func_team, func_role,
      tech_effort_adj, tech_team, tech_role,
      classification, complexity)
    VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?, ?,?)
  `).run(
    projectId, ricef_type_id, nextSeq, ricefNumber, ricefType.label,
    req.body.backlog_number || null, req.body.architecture_ref || null,
    req.body.tsa_group || null, req.body.tsa_process || null,
    req.body.special_notes || null, req.body.predecessor || null,
    req.body.module || null, req.body.description || null,
    req.body.design_notes || null, req.body.status || 'New',
    req.body.func_effort_adj || 1, req.body.func_team || 'SYNTAX',
    req.body.func_role || null,
    req.body.tech_effort_adj || 1, req.body.tech_team || 'SYNTAX',
    req.body.tech_role || null,
    req.body.classification || null, req.body.complexity || '0-TBD'
  );

  const itemId = result.lastInsertRowid;
  calculateItem(db, itemId);

  const item = db.prepare(
    `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
     FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = ?`
  ).get(itemId);

  res.status(201).json(item);
});

router.get('/:projectId/items/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare(
    `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
     FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = ? AND i.project_id = ?`
  ).get(req.params.id, req.params.projectId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.put('/:projectId/items/:id', (req, res) => {
  const db = getDb();
  const fields = [
    'backlog_number', 'architecture_ref', 'tsa_group', 'tsa_process',
    'special_notes', 'predecessor', 'module', 'description', 'design_notes',
    'status', 'func_effort_adj', 'func_team', 'func_role',
    'tech_effort_adj', 'tech_team', 'tech_role',
    'classification', 'complexity'
  ];

  const setClauses = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      setClauses.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (setClauses.length === 0) return res.json({ ok: true });

  setClauses.push("updated_at = datetime('now')");
  values.push(req.params.id, req.params.projectId);

  db.prepare(
    `UPDATE items SET ${setClauses.join(', ')} WHERE id = ? AND project_id = ?`
  ).run(...values);

  if (req.body.module) {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    const rt = db.prepare('SELECT * FROM ricef_types WHERE id = ?').get(item.ricef_type_id);
    const newNumber = `${req.body.module}-${rt.code}-${String(item.seq_number).padStart(4, '0')}`;
    db.prepare('UPDATE items SET ricef_number = ? WHERE id = ?').run(newNumber, req.params.id);
  }

  calculateItem(db, req.params.id);

  const item = db.prepare(
    `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
     FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = ?`
  ).get(req.params.id);
  res.json(item);
});

router.delete('/:projectId/items/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM items WHERE id = ? AND project_id = ?')
    .run(req.params.id, req.params.projectId);
  res.json({ ok: true });
});

router.post('/:projectId/items/:id/calculate', (req, res) => {
  const db = getDb();
  calculateItem(db, req.params.id);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json(item);
});

router.post('/:projectId/recalculate-all', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT id FROM items WHERE project_id = ?')
    .all(req.params.projectId);

  const recalc = db.transaction(() => {
    for (const item of items) {
      calculateItem(db, item.id);
    }
  });
  recalc();

  res.json({ recalculated: items.length });
});

module.exports = router;
