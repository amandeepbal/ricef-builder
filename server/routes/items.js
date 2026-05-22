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

router.get('/:projectId/items-pdf', (req, res) => {
  const PDFDocument = require('pdfkit');
  const db = getDb();
  const pid = req.params.projectId;
  const sheetType = req.query.sheetType || 'RICEF';

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const rows = db.prepare(`
    SELECT i.*, rt.code AS type_code, rt.label AS type_label
    FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
    WHERE i.project_id = ? AND rt.sheet_type_code = ?
    ORDER BY rt.sort_order, i.ricef_number,
      CASE WHEN i.classification = 'TOTAL' THEN 0 ELSE 1 END, i.seq_number, i.id
  `).all(pid, sheetType);

  const s = (v) => v != null ? String(v) : '';
  const n = (v) => v != null ? String(Math.round(v * 10) / 10) : '';

  let totalFunc = 0, totalTech = 0, totalGrand = 0;
  rows.filter(r => r.seq_number > 0).forEach(r => {
    totalFunc += r.total_func_hours || 0;
    totalTech += r.total_tech_hours || 0;
    totalGrand += r.grand_total_hours || 0;
  });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 30, left: 30, right: 30 }, bufferPages: true, autoFirstPage: true });
  const filename = `${project.project_number}_${sheetType}_Items.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const cols = [
    { label: 'RICEF #',        width: 70,  align: 'left' },
    { label: 'Type',            width: 65,  align: 'left' },
    { label: 'Module',          width: 40,  align: 'left' },
    { label: 'Description',     width: 180, align: 'left' },
    { label: 'Status',          width: 50,  align: 'left' },
    { label: 'Classification',  width: 110, align: 'left' },
    { label: 'Complexity',      width: 60,  align: 'left' },
    { label: 'FUNC Hrs',        width: 48,  align: 'right' },
    { label: 'TECH Hrs',        width: 48,  align: 'right' },
    { label: 'Total Hrs',       width: 50,  align: 'right' },
  ];
  const tableLeft = 30;
  const tableWidth = cols.reduce((sum, c) => sum + c.width, 0);
  const rowHeight = 13;
  const headerHeight = 15;
  const pageBottom = doc.page.height - 40;

  function truncate(text, font, fontSize, maxWidth) {
    doc.font(font).fontSize(fontSize);
    if (doc.widthOfString(text) <= maxWidth) return text;
    while (text.length > 0 && doc.widthOfString(text + '...') > maxWidth) {
      text = text.slice(0, -1);
    }
    return text + '...';
  }

  function drawHeader() {
    doc.save();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0854a0');
    doc.text(`${project.description} — ${sheetType} Items`, tableLeft, 30, { lineBreak: false, height: 18 });
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    doc.text(`Project ${s(project.project_number)} | ${project.currency} | Level ${project.delivery_level} | ${rows.filter(r => r.seq_number > 0).length} items | ${new Date().toISOString().slice(0, 10)}`, tableLeft, 48, { lineBreak: false, height: 12 });
    doc.restore();
    return 65;
  }

  function drawTableHeader(y) {
    doc.save();
    doc.rect(tableLeft, y, tableWidth, headerHeight).fill('#0854a0');
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#ffffff');
    let x = tableLeft;
    cols.forEach(col => {
      const avail = col.width - 6;
      const tx = col.align === 'right' ? x + col.width - 3 - avail : x + 3;
      doc.text(col.label.toUpperCase(), tx, y + 4, { width: avail, align: col.align, height: headerHeight - 4, lineBreak: false, ellipsis: true });
      x += col.width;
    });
    doc.restore();
    return y + headerHeight;
  }

  function drawRow(y, cells, opts) {
    opts = opts || {};
    doc.save();
    if (opts.bg) {
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill(opts.bg);
    }
    doc.rect(tableLeft, y + rowHeight - 0.5, tableWidth, 0.5).fill('#e0e0e0');

    const fontSize = opts.sub ? 6 : 7;
    const fontName = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const baseColor = opts.sub ? '#777' : opts.color || '#333';

    let x = tableLeft;
    cells.forEach((val, i) => {
      const col = cols[i];
      const avail = col.width - 6;

      let cellFont = fontName;
      let cellColor = baseColor;
      if (i === opts.complexityCol && opts.complexityColor) {
        cellColor = opts.complexityColor;
        cellFont = 'Helvetica-Bold';
      }

      const clipped = truncate(val, cellFont, fontSize, avail);
      doc.font(cellFont).fontSize(fontSize).fillColor(cellColor);
      const tx = col.align === 'right' ? x + col.width - 3 - avail : x + 3;
      doc.text(clipped, tx, y + 3, { width: avail, align: col.align, height: rowHeight - 3, lineBreak: false });
      x += col.width;
    });

    if (opts.strikethrough) {
      const lineY = y + rowHeight / 2;
      doc.save();
      doc.moveTo(tableLeft + 3, lineY).lineTo(tableLeft + tableWidth - 3, lineY)
        .lineWidth(0.5).strokeColor('#aaa').stroke();
      doc.restore();
    }

    doc.restore();
    return y + rowHeight;
  }

  function drawGroupRow(y, text) {
    doc.save();
    doc.rect(tableLeft, y, tableWidth, rowHeight).fill('#f0f0f0');
    doc.rect(tableLeft, y + rowHeight - 1, tableWidth, 1).fill('#ccc');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#333');
    doc.text(text, tableLeft + 3, y + 3, { width: tableWidth - 6, height: rowHeight - 3, lineBreak: false });
    doc.restore();
    return y + rowHeight;
  }

  function checkPage(y, needed) {
    if (y + needed > pageBottom) {
      doc.addPage();
      y = drawTableHeader(20);
    }
    return y;
  }

  let y = drawHeader();
  y = drawTableHeader(y);

  let lastType = '';
  rows.forEach(r => {
    const isSub = r.seq_number === 0;
    const isTotal = r.classification === 'TOTAL';

    if (r.type_code !== lastType && !isSub) {
      y = checkPage(y, rowHeight * 2);
      y = drawGroupRow(y, `${r.type_label} (${r.type_code})`);
      lastType = r.type_code;
    }

    y = checkPage(y, rowHeight);
    const isCancelled = r.status === 'Cancelled';
    const ricefNum = isSub ? '  ↳ ' + s(r.ricef_number) : s(r.ricef_number);
    const cells = [ricefNum, s(r.type_label), s(r.module), s(r.description), s(r.status),
      s(r.classification), s(r.complexity), n(r.total_func_hours), n(r.total_tech_hours), n(r.grand_total_hours)];

    const complexColors = { '5-Very High': '#9b0000', '4-High': '#cc4400', '3-Medium': '#0854a0', '2-Low': '#2a7b2a', '1-Very Low': '#5a9e5a', '0-TBD': '#aa0000' };

    y = drawRow(y, cells, {
      bg: isTotal ? '#e8f0fe' : isCancelled ? '#f5f5f5' : null,
      bold: isTotal,
      sub: isSub,
      strikethrough: isCancelled,
      color: isCancelled ? '#aaa' : null,
      complexityCol: 6,
      complexityColor: complexColors[r.complexity] || null
    });
  });

  // Totals footer
  y = checkPage(y, rowHeight + 4);
  doc.save();
  doc.rect(tableLeft, y, tableWidth, 1.5).fill('#0854a0');
  doc.restore();
  y += 2;
  const totCells = ['', '', '', '', '', '', 'TOTALS', n(totalFunc), n(totalTech), n(totalGrand)];
  y = drawRow(y, totCells, { bold: true, bg: '#f8f8f8' });

  // Page numbers
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.fontSize(6).font('Helvetica').fillColor('#999');
    doc.text(`Page ${i + 1} of ${pageCount}`, tableLeft, doc.page.height - 25, { width: tableWidth, align: 'center', height: 10, lineBreak: false });
    doc.restore();
  }

  doc.end();
});

module.exports = router;
