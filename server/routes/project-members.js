const { Router } = require('express');
const { getPool } = require('../db/connection');
const { checkProjectRole } = require('../middleware/project-access');
const router = Router();

router.get('/:projectId/members', checkProjectRole('viewer'), async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, project_id, user_email, role, added_by, created_at FROM project_members WHERE project_id = $1 ORDER BY role DESC, user_email',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/:projectId/members', checkProjectRole('supervisor'), async (req, res, next) => {
  try {
    const pool = getPool();
    const { user_email, role } = req.body;
    if (!user_email) return res.status(400).json({ error: 'user_email is required' });
    if (!['viewer', 'member', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'role must be viewer, member, or supervisor' });
    }

    const existing = (await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_email = $2',
      [req.params.projectId, user_email.toLowerCase().trim()]
    )).rows[0];

    if (existing) {
      await pool.query('UPDATE project_members SET role = $1 WHERE id = $2', [role, existing.id]);
      return res.json({ ok: true, updated: true });
    }

    const result = await pool.query(
      'INSERT INTO project_members (project_id, user_email, role, added_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.params.projectId, user_email.toLowerCase().trim(), role, req.user.email || req.user.id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { next(e); }
});

router.put('/:projectId/members/:memberId', checkProjectRole('supervisor'), async (req, res, next) => {
  try {
    const pool = getPool();
    const { role } = req.body;
    if (!['viewer', 'member', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'role must be viewer, member, or supervisor' });
    }
    await pool.query(
      'UPDATE project_members SET role = $1 WHERE id = $2 AND project_id = $3',
      [role, req.params.memberId, req.params.projectId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:projectId/members/:memberId', checkProjectRole('supervisor'), async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query(
      'DELETE FROM project_members WHERE id = $1 AND project_id = $2',
      [req.params.memberId, req.params.projectId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
