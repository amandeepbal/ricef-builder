function setupAuth(app) {
  if (process.env.VCAP_SERVICES) {
    const xssec = require('@sap/xssec');
    const xsenv = require('@sap/xsenv');

    xsenv.loadEnv();
    const uaaCredentials = xsenv.getServices({ uaa: { tag: 'xsuaa' } }).uaa;

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = { id: 'anonymous', name: '', isAdmin: false, isUser: false };
        return next();
      }

      const token = authHeader.substring(7);
      try {
        xssec.createSecurityContext(token, uaaCredentials, (err, securityContext) => {
          if (err) {
            console.error('JWT validation failed:', err.message);
            req.user = { id: 'anonymous', name: '', isAdmin: false, isUser: false };
            return next();
          }

          req.authInfo = securityContext;
          req.user = {
            id: securityContext.getEmail() || securityContext.getLogonName() || 'unknown',
            name: securityContext.getGivenName() || '',
            isAdmin: securityContext.checkScope(uaaCredentials.xsappname + '.Admin'),
            isUser: securityContext.checkScope(uaaCredentials.xsappname + '.User')
          };
          next();
        });
      } catch (err) {
        console.error('Security context error:', err.message);
        req.user = { id: 'anonymous', name: '', isAdmin: false, isUser: false };
        next();
      }
    });

    console.log('XSUAA authentication enabled.');
    return;
  }

  app.use((req, res, next) => {
    req.user = { id: 'local', name: 'Local User', isAdmin: true, isUser: true };
    next();
  });
  console.log('Running without authentication (local mode).');
}

module.exports = { setupAuth };
