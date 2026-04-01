const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function check() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  const sys = await db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='sale_numbers'");
  console.log("SCHEMA:", sys[0]?.sql);
  
  const sn = await db.all("SELECT * FROM sale_numbers");
  console.log("\nDATA:", sn);
}

check().catch(console.error);
