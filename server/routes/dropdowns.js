const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM dropdown_categories ORDER BY id').all());
});

router.get('/:code', (req, res) => {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM dropdown_categories WHERE code = ?').get(req.params.code);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  cat.values = db.prepare(
    'SELECT * FROM dropdown_values WHERE category_id = ? ORDER BY sort_order'
  ).all(cat.id);
  cat.values.forEach(v => {
    v.is_active = !!v.is_active;
    v.is_separator = !!v.is_separator;
  });
  res.json(cat);
});

router.post('/:code/values', (req, res) => {
  const db = getDb();
  const cat = db.prepare('SELECT id FROM dropdown_categories WHERE code = ?').get(req.params.code);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  let sortOrder;
  if (req.body.insert_after != null) {
    const after = parseInt(req.body.insert_after);
    db.prepare(
      'UPDATE dropdown_values SET sort_order = sort_order + 1 WHERE category_id = ? AND sort_order > ?'
    ).run(cat.id, after);
    sortOrder = after + 1;
  } else if (req.body.sort_order != null) {
    sortOrder = parseInt(req.body.sort_order);
  } else {
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) AS mx FROM dropdown_values WHERE category_id = ?'
    ).get(cat.id);
    sortOrder = (maxOrder.mx || 0) + 1;
  }

  const result = db.prepare(
    `INSERT INTO dropdown_values (category_id, value, display_label, is_separator, sort_order)
     VALUES (?,?,?,?,?)`
  ).run(cat.id, req.body.value, req.body.display_label || null,
    req.body.is_separator || 0, sortOrder);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:code/values/:id', (req, res) => {
  const db = getDb();
  const { value, display_label, is_separator, sort_order, is_active } = req.body;
  db.prepare(
    `UPDATE dropdown_values SET value=?, display_label=?, is_separator=?, sort_order=?, is_active=?
     WHERE id=?`
  ).run(value, display_label, is_separator, sort_order, is_active, req.params.id);
  res.json({ ok: true });
});

router.delete('/:code/values/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM dropdown_values WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
