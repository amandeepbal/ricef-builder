const passport = require('passport');

function setupAuth(app) {
  if (process.env.VCAP_SERVICES) {
    const xssec = require('@sap/xssec');
    const xsenv = require('@sap/xsenv');

    xsenv.loadEnv();
    const uaaCredentials = xsenv.getServices({ uaa: { tag: 'xsuaa' } }).uaa;

    passport.use('JWT', new xssec.XssecPassportStrategy(uaaCredentials));
    app.use(passport.initialize());

    app.use((req, res, next) => {
      passport.authenticate('JWT', { session: false }, (err, user, info) => {
        if (err || !user) {
          req.user = { id: 'anonymous', name: '', isAdmin: false, isUser: false };
        } else {
          const ctx = req[xssec.SECURITY_CONTEXT] || req.authInfo;
          req.user = {
            id: (ctx && ctx.getEmail ? ctx.getEmail() : '') || (ctx && ctx.getLogonName ? ctx.getLogonName() : '') || 'unknown',
            name: (ctx && ctx.getGivenName ? ctx.getGivenName() : '') || '',
            isAdmin: ctx && ctx.checkScope ? ctx.checkScope(uaaCredentials.xsappname + '.Admin') : false,
            isUser: ctx && ctx.checkScope ? ctx.checkScope(uaaCredentials.xsappname + '.User') : false
          };
        }
        next();
      })(req, res, next);
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
