const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/tobacco.db');

db.all('SELECT * FROM tickets ORDER BY createdAt DESC LIMIT 5', [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
