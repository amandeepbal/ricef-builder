const { getPool } = require('../db/connection');

const ROLE_LEVELS = { viewer: 1, member: 2, supervisor: 3 };

function checkProjectRole(minRole) {
  return async function (req, res, next) {
    try {
      if (req.user.isAdmin) return next();

      const projectId = req.params.projectId || req.params.id;
      if (!projectId) return next();

      const pool = getPool();
      const result = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_email = $2',
        [projectId, req.user.email || req.user.id]
      );

      const membership = result.rows[0];
      if (!membership) {
        return res.status(403).json({ error: 'You do not have access to this project' });
      }

      const userLevel = ROLE_LEVELS[membership.role] || 0;
      const requiredLevel = ROLE_LEVELS[minRole] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ error: 'Insufficient permissions. Required: ' + minRole });
      }

      req.projectRole = membership.role;
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { checkProjectRole, ROLE_LEVELS };
