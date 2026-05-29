function setupAuth(app) {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const xsuaaService = (vcap.xsuaa || [])[0];
    const xsappname = xsuaaService ? xsuaaService.credentials.xsappname : '';

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = { id: 'anonymous', name: 'Anonymous', email: '', isAdmin: false, isUser: false };
        return next();
      }

      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT');

        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
          return res.status(401).json({ error: 'Token expired' });
        }

        const scopes = payload.scope || [];

        req.user = {
          id: payload.user_name || payload.sub || 'unknown',
          name: payload.given_name
            ? (payload.given_name + ' ' + (payload.family_name || '')).trim()
            : payload.user_name || 'Unknown',
          email: payload.email || payload.user_name || '',
          isAdmin: scopes.includes(xsappname + '.Admin'),
          isUser: scopes.includes(xsappname + '.User') || scopes.length > 0
        };
      } catch (err) {
        console.error('JWT decode error:', err.message);
        req.user = { id: 'anonymous', name: 'Anonymous', email: '', isAdmin: false, isUser: false };
      }
      next();
    });

    console.log('XSUAA authentication enabled (JWT decode).');
    return;
  }

  app.use((req, res, next) => {
    req.user = { id: 'local', name: 'Local User', email: '', isAdmin: true, isUser: true };
    next();
  });
  console.log('Running without authentication (local mode).');
}

module.exports = { setupAuth };
