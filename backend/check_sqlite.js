const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./context_engine.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log("Tables:", tables.map(t => t.name));
    
    // For each table, get the count of rows
    tables.forEach(table => {
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
        if (!err) {
          console.log(`Table ${table.name} has ${row.count} rows`);
        }
      });
    });
  });
});
