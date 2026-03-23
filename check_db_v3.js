const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

db.all('PRAGMA table_info(tickets)', [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('--- TABLE INFO (tickets) ---');
  console.log(JSON.stringify(rows.map(r => r.name), null, 2));

  db.all('SELECT * FROM tickets ORDER BY createdAt DESC LIMIT 5', [], (err, tickets) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('--- RECENT TICKETS ---');
    console.log(JSON.stringify(tickets, null, 2));
    db.close();
  });
});
