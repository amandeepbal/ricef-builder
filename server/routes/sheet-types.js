const { Router } = require('express');
const { getDb } = require('../db/connection');
const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM sheet_types WHERE is_active = 1 ORDER BY sort_order').all());
});

router.get('/:code/columns', (req, res) => {
  const db = getDb();
  const vid = req.query.version_id || 1;
  const rows = db.prepare(
    'SELECT * FROM sheet_column_config WHERE sheet_type_code = ? AND version_id = ? ORDER BY sort_order'
  ).all(req.params.code, vid);
  rows.forEach(r => {
    r.is_visible = !!r.is_visible;
    r.is_editable = !!r.is_editable;
  });
  res.json(rows);
});

router.put('/:code/columns', (req, res) => {
  const db = getDb();
  const { columns } = req.body;
  const update = db.prepare(
    `UPDATE sheet_column_config SET column_label=?, is_visible=?, is_editable=?, sort_order=?, width=?
     WHERE sheet_type_code=? AND column_key=?`
  );
  const txn = db.transaction(() => {
    for (const col of columns) {
      update.run(col.column_label, col.is_visible, col.is_editable, col.sort_order, col.width,
        req.params.code, col.column_key);
    }
  });
  txn();
  res.json({ ok: true });
});

module.exports = router;
