function authMiddleware(req, res, next) {
  // Placeholder for XSUAA integration
  // When migrating to BTP, replace with passport-xsuaa or @sap/xssec
  req.user = { id: 'local', role: 'admin' };
  next();
}

module.exports = authMiddleware;
