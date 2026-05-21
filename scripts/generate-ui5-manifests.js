const fs = require('fs');
const path = require('path');

const libs = [
  { pkg: 'sap.ui.core', name: 'sap.ui.core', dir: 'sap/ui/core' },
  { pkg: 'sap.m', name: 'sap.m', dir: 'sap/m' },
  { pkg: 'sap.ui.table', name: 'sap.ui.table', dir: 'sap/ui/table' },
  { pkg: 'sap.ui.unified', name: 'sap.ui.unified', dir: 'sap/ui/unified' },
  { pkg: 'sap.tnt', name: 'sap.tnt', dir: 'sap/tnt' },
  { pkg: 'sap.ui.layout', name: 'sap.ui.layout', dir: 'sap/ui/layout' },
  { pkg: 'sap.f', name: 'sap.f', dir: 'sap/f' },
];

const baseDir = path.join(__dirname, '..', 'node_modules', '@openui5');

for (const lib of libs) {
  const manifestPath = path.join(baseDir, lib.pkg, 'src', lib.dir, 'manifest.json');

  if (fs.existsSync(manifestPath)) {
    console.log(`EXISTS: ${lib.name}`);
    continue;
  }

  const pkgPath = path.join(baseDir, lib.pkg, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const manifest = {
    "sap.app": {
      "id": lib.name,
      "type": "library",
      "title": lib.name,
      "applicationVersion": { "version": pkg.version }
    },
    "sap.ui5": {
      "library": {
        "i18n": false
      }
    }
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`CREATED: ${manifestPath}`);
}

console.log('Done.');
