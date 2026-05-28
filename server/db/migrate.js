const { initDb, getPool } = require('./connection');

initDb()
  .then(() => {
    console.log('Migration complete.');
    return getPool().end();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
