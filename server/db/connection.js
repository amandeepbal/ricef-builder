const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let _pool;

function getPool() {
  if (_pool) return _pool;

  let config;

  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const pgService = (vcap['postgresql-db'] || vcap.postgresql || [])[0];
    if (pgService) {
      const creds = pgService.credentials;
      config = {
        host: creds.hostname || creds.host,
        port: creds.port,
        database: creds.dbname || creds.database,
        user: creds.username || creds.user,
        password: creds.password,
        ssl: creds.sslcert ? { ca: creds.sslcert } : { rejectUnauthorized: false },
        max: 10
      };
    }
  }

  if (!config) {
    config = {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'ricef_builder',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      max: 10
    };
  }

  _pool = new Pool(config);
  return _pool;
}

async function initDb() {
  const pool = getPool();

  const tableCheck = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects'"
  );

  if (tableCheck.rows.length === 0) {
    console.log('Initializing database schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    console.log('Seeding reference data...');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(seed);

    console.log('Database initialized.');
  } else {
    console.log('Database already exists, skipping init.');
  }
}

module.exports = { getPool, initDb };
