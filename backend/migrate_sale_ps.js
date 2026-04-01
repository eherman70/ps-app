const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE sale_numbers ADD COLUMN ps VARCHAR(50) DEFAULT 'All'", (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column ps already exists.');
      } else {
        console.error('Error adding ps column:', err);
      }
    } else {
      console.log('Successfully added ps column to sale_numbers.');
    }
  });
});

db.close();
