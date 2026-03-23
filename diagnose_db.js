const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

console.log('--- DATABASE DIAGNOSTICS ---');

db.serialize(() => {
  console.log('\n[1] Sample Tickets (Last 5 with missing saleNumberId):');
  db.all("SELECT id, ticketNumber, pcnNumber, saleNumberId, ps FROM tickets WHERE saleNumberId = '' OR saleNumberId IS NULL ORDER BY createdAt DESC LIMIT 5", (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
  });

  console.log('\n[2] Sample PCNs matching those PCN numbers:');
  db.all("SELECT pcnNumber, saleNumber, ps FROM pcns WHERE pcnNumber IN (SELECT pcnNumber FROM tickets WHERE saleNumberId = '' OR saleNumberId IS NULL) LIMIT 5", (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
  });

  console.log('\n[3] Sale Numbers available:');
  db.all("SELECT id, saleNumber FROM sale_numbers LIMIT 5", (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
  });

  console.log('\n[4] PCN Count:');
  db.get("SELECT COUNT(*) as count FROM pcns", (err, row) => {
    console.log(JSON.stringify(row));
  });
});

setTimeout(() => db.close(), 2000);
