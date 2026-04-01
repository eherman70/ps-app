const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function migrate() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  console.log("Starting migration...");

  await db.exec(`
    PRAGMA foreign_keys=off;
    BEGIN TRANSACTION;

    CREATE TABLE IF NOT EXISTS sale_numbers_new (
      id VARCHAR(36) PRIMARY KEY,
      saleNumber VARCHAR(50) NOT NULL,
      marketCenterId VARCHAR(36) NOT NULL,
      seasonId VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (seasonId) REFERENCES seasons(id),
      UNIQUE(saleNumber, marketCenterId, seasonId)
    );

    INSERT INTO sale_numbers_new (id, saleNumber, marketCenterId, seasonId, status, createdAt)
    SELECT id, saleNumber, marketCenterId, seasonId, status, createdAt FROM sale_numbers;

    DROP TABLE sale_numbers;
    ALTER TABLE sale_numbers_new RENAME TO sale_numbers;

    COMMIT;
    PRAGMA foreign_keys=on;
  `);

  console.log("Migration completed.");
}

migrate().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
