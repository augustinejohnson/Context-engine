const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'context_engine.db');
const db = new Database(dbPath);

console.log("Bible Verses Count:", db.prepare('SELECT COUNT(*) as c FROM bible_verses').get().c);
console.log("Settings:", db.prepare('SELECT * FROM system_settings').all());
