const passport = require('passport');
const xssec = require('@sap/xssec');
const { JWTStrategy } = xssec;

function setupAuth(app) {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const xsuaaService = (vcap.xsuaa || [])[0];

    if (xsuaaService) {
      passport.use(new JWTStrategy(xsuaaService.credentials));
      app.use(passport.initialize());
      app.use(passport.authenticate('JWT', { session: false }));

      app.use((req, res, next) => {
        req.user = {
          id: req.authInfo.getEmail() || req.authInfo.getLogonName() || 'unknown',
          name: req.authInfo.getGivenName() || '',
          isAdmin: req.authInfo.checkScope(xsuaaService.credentials.xsappname + '.Admin'),
          isUser: req.authInfo.checkScope(xsuaaService.credentials.xsappname + '.User')
        };
        next();
      });

      console.log('XSUAA authentication enabled.');
      return;
    }
  }

  app.use((req, res, next) => {
    req.user = { id: 'local', name: 'Local User', isAdmin: true, isUser: true };
    next();
  });
  console.log('Running without authentication (local mode).');
}

module.exports = { setupAuth };
