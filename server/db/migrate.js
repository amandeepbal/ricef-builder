const { initDb } = require('./connection');
initDb();
console.log('Migration complete.');
process.exit(0);
