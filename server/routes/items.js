const { Router } = require('express');
const { getPool } = require('../db/connection');
const { calculateItem } = require('../services/estimation-engine');
const router = Router();

router.get('/:projectId/items', async (req, res, next) => {
  try {
    const pool = getPool();
    const { sheetType, ricefTypeId, status, module: mod, complexity, search } = req.query;

    let sql = `SELECT i.*, rt.code AS type_code, rt.label AS type_label,
                      rt.sheet_type_code
               FROM items i
               JOIN ricef_types rt ON i.ricef_type_id = rt.id
               WHERE i.project_id = $1`;
    const params = [req.params.projectId];
    let paramIdx = 2;

    if (sheetType) {
      sql += ` AND rt.sheet_type_code = $${paramIdx++}`;
      params.push(sheetType);
    }
    if (ricefTypeId) {
      sql += ` AND i.ricef_type_id = $${paramIdx++}`;
      params.push(ricefTypeId);
    }
    if (status) {
      sql += ` AND i.status = $${paramIdx++}`;
      params.push(status);
    }
    if (mod) {
      sql += ` AND i.module = $${paramIdx++}`;
      params.push(mod);
    }
    if (complexity) {
      sql += ` AND i.complexity = $${paramIdx++}`;
      params.push(complexity);
    }
    if (search) {
      sql += ` AND (i.description LIKE $${paramIdx} OR i.ricef_number LIKE $${paramIdx + 1} OR i.special_notes LIKE $${paramIdx + 2})`;
      const term = `%${search}%`;
      params.push(term, term, term);
      paramIdx += 3;
    }

    sql += ` ORDER BY rt.sort_order, i.ricef_number, CASE WHEN i.classification = 'TOTAL' THEN 0 ELSE 1 END, i.seq_number, i.id`;
    const rows = (await pool.query(sql, params)).rows;
    rows.forEach(r => { r.is_sub_item = (r.seq_number === 0); });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/:projectId/items', async (req, res, next) => {
  try {
    const pool = getPool();
    const projectId = req.params.projectId;
    const { ricef_type_id } = req.body;

    const ricefType = (await pool.query('SELECT * FROM ricef_types WHERE id = $1', [ricef_type_id])).rows[0];
    if (!ricefType) return res.status(400).json({ error: 'Invalid RICEF type' });

    const maxSeq = (await pool.query(
      'SELECT MAX(seq_number) AS mx FROM items WHERE project_id = $1 AND ricef_type_id = $2',
      [projectId, ricef_type_id]
    )).rows[0];

    const nextSeq = maxSeq.mx ? maxSeq.mx + 1 : ricefType.seq_from;
    const modulePrefix = req.body.module || 'XX';
    const ricefNumber = `${modulePrefix}-${ricefType.code}-${String(nextSeq).padStart(4, '0')}`;

    const { rows: insertRows } = await pool.query(`
      INSERT INTO items (project_id, ricef_type_id, seq_number, ricef_number, object_type,
        backlog_number, architecture_ref, tsa_group, tsa_process, special_notes,
        predecessor, module, description, design_notes, status,
        func_effort_adj, func_team, func_role,
        tech_effort_adj, tech_team, tech_role,
        classification, complexity)
      VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10, $11,$12,$13,$14,$15, $16,$17,$18, $19,$20,$21, $22,$23) RETURNING id
    `, [
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
    ]);

    const itemId = insertRows[0].id;
    await calculateItem(pool, itemId);

    const item = (await pool.query(
      `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
       FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = $1`,
      [itemId]
    )).rows[0];

    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/items/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const item = (await pool.query(
      `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
       FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = $1 AND i.project_id = $2`,
      [req.params.id, req.params.projectId]
    )).rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:projectId/items/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const fields = [
      'backlog_number', 'architecture_ref', 'tsa_group', 'tsa_process',
      'special_notes', 'predecessor', 'module', 'description', 'design_notes',
      'status', 'func_effort_adj', 'func_team', 'func_role',
      'tech_effort_adj', 'tech_team', 'tech_role',
      'classification', 'complexity'
    ];

    const setClauses = [];
    const values = [];
    let paramIdx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = $${paramIdx++}`);
        values.push(req.body[f]);
      }
    }

    if (setClauses.length === 0) return res.json({ ok: true });

    setClauses.push(`updated_at = NOW()`);
    values.push(req.params.id, req.params.projectId);

    await pool.query(
      `UPDATE items SET ${setClauses.join(', ')} WHERE id = $${paramIdx++} AND project_id = $${paramIdx++}`,
      values
    );

    if (req.body.module) {
      const item = (await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id])).rows[0];
      const rt = (await pool.query('SELECT * FROM ricef_types WHERE id = $1', [item.ricef_type_id])).rows[0];
      const newNumber = `${req.body.module}-${rt.code}-${String(item.seq_number).padStart(4, '0')}`;
      await pool.query('UPDATE items SET ricef_number = $1 WHERE id = $2', [newNumber, req.params.id]);
    }

    await calculateItem(pool, req.params.id);

    const item = (await pool.query(
      `SELECT i.*, rt.code AS type_code, rt.label AS type_label, rt.sheet_type_code
       FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id WHERE i.id = $1`,
      [req.params.id]
    )).rows[0];
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:projectId/items/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM items WHERE id = $1 AND project_id = $2',
      [req.params.id, req.params.projectId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:projectId/items/:id/calculate', async (req, res, next) => {
  try {
    const pool = getPool();
    await calculateItem(pool, req.params.id);
    const item = (await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id])).rows[0];
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/:projectId/recalculate-all', async (req, res, next) => {
  try {
    const pool = getPool();
    const items = (await pool.query('SELECT id FROM items WHERE project_id = $1',
      [req.params.projectId])).rows;

    for (const item of items) {
      await calculateItem(pool, item.id);
    }

    res.json({ recalculated: items.length });
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/items-pdf', async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const pool = getPool();
    const pid = req.params.projectId;
    const sheetType = req.query.sheetType || 'RICEF';

    const project = (await pool.query('SELECT * FROM projects WHERE id = $1', [pid])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const rows = (await pool.query(`
      SELECT i.*, rt.code AS type_code, rt.label AS type_label
      FROM items i JOIN ricef_types rt ON i.ricef_type_id = rt.id
      WHERE i.project_id = $1 AND rt.sheet_type_code = $2
      ORDER BY rt.sort_order, i.ricef_number,
        CASE WHEN i.classification = 'TOTAL' THEN 0 ELSE 1 END, i.seq_number, i.id
    `, [pid, sheetType])).rows;

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
  } catch (e) {
    next(e);
  }
});

module.exports = router;
