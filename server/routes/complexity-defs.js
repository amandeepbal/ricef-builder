const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const vid = req.query.version_id || 1;
  const defs = db.prepare('SELECT * FROM complexity_definitions WHERE version_id = ? ORDER BY team, classification_group').all(vid);
  for (const d of defs) {
    d.factors = db.prepare(
      'SELECT * FROM complexity_factors WHERE definition_id = ? ORDER BY sort_order'
    ).all(d.id);
  }
  res.json(defs);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const def = db.prepare('SELECT * FROM complexity_definitions WHERE id = ?').get(req.params.id);
  if (!def) return res.status(404).json({ error: 'Not found' });
  def.factors = db.prepare(
    'SELECT * FROM complexity_factors WHERE definition_id = ? ORDER BY sort_order'
  ).all(def.id);
  res.json(def);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`
    UPDATE complexity_definitions SET team=?, classification_group=?, subgroup=?,
      func_very_low=?, func_low=?, func_medium=?, func_high=?, func_very_high=?,
      tech_very_low=?, tech_low=?, tech_medium=?, tech_high=?, tech_very_high=?
    WHERE id=?
  `).run(b.team, b.classification_group, b.subgroup,
    b.func_very_low, b.func_low, b.func_medium, b.func_high, b.func_very_high,
    b.tech_very_low, b.tech_low, b.tech_medium, b.tech_high, b.tech_very_high,
    req.params.id);
  res.json({ ok: true });
});

router.post('/', (req, res) => {
  const db = getDb();
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO complexity_definitions (version_id, team, classification_group, subgroup,
      func_very_low, func_low, func_medium, func_high, func_very_high,
      tech_very_low, tech_low, tech_medium, tech_high, tech_very_high)
    VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?)
  `).run(b.version_id || 1, b.team, b.classification_group, b.subgroup,
    b.func_very_low, b.func_low, b.func_medium, b.func_high, b.func_very_high,
    b.tech_very_low, b.tech_low, b.tech_medium, b.tech_high, b.tech_very_high);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM complexity_factors WHERE definition_id = ?').run(req.params.id);
  db.prepare('DELETE FROM complexity_definitions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
