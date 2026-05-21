const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'ricef-builder.db');

let _db;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function initDb() {
  const db = getDb();
  const fs = require('fs');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  const tableCheck = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
  ).get();

  if (!tableCheck) {
    console.log('Initializing database schema...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    console.log('Seeding reference data...');
    const seed = fs.readFileSync(seedPath, 'utf8');
    db.exec(seed);

    console.log('Database initialized.');
  } else {
    console.log('Database already exists, skipping init.');
  }
}

module.exports = { getDb, initDb };
