'use strict';
/**
 * db.js — Shared database adapter
 * Exports `db` (the query executor) once initializeDatabase() resolves.
 * All route modules import from here; the pool lives in exactly one place.
 */

const { Pool } = require('pg');

// ── PostgreSQL camelCase column map ──────────────────────────────────────────
const PG_COL_MAP = {
  'createdat': 'createdAt', 'updatedat': 'updatedAt',
  'fullname': 'fullName', 'darkmode': 'darkMode', 'testmode': 'testMode',
  'startdate': 'startDate', 'enddate': 'endDate',
  'farmernumber': 'farmerNumber', 'firstname': 'firstName',
  'middlename': 'middleName', 'lastname': 'lastName',
  'phonenumber': 'phoneNumber', 'idtype': 'idType', 'idnumber': 'idNumber',
  'seasonid': 'seasonId', 'seasonname': 'seasonName',
  'contractedvolume': 'contractedVolume',
  'ticketnumber': 'ticketNumber', 'pcnnumber': 'pcnNumber',
  'farmerid': 'farmerId', 'gradeid': 'gradeId',
  'marketcenterid': 'marketCenterId', 'salenumberid': 'saleNumberId',
  'grossweight': 'grossWeight', 'tareweight': 'tareWeight', 'netweight': 'netWeight',
  'priceperkg': 'pricePerKg', 'totalvalue': 'totalValue',
  'capturedate': 'captureDate', 'marketcentername': 'marketCenterName',
  'salenumber': 'saleNumber', 'gradename': 'gradeName',
  'gradecategory': 'gradeCategory', 'gradelevel': 'gradeLevel', 'gcode': 'gCode',
  'totalfarmers': 'totalFarmers', 'totaltickets': 'totalTickets',
  'totalweight': 'totalWeight', 'closedat': 'closedAt', 'closedby': 'closedBy',
  'approvedat': 'approvedAt', 'approvedby': 'approvedBy',
  'pcnid': 'pcnId', 'tobaccoamount': 'tobaccoAmount',
  'inputdeduction': 'inputDeduction', 'usdbalance': 'usdBalance',
  'exchangerate': 'exchangeRate', 'tzsgross': 'tzsGross',
  'adminfee': 'adminFee', 'totaldeductions': 'totalDeductions',
  'netpayment': 'netPayment', 'paymentdate': 'paymentDate',
  'inputtypeid': 'inputTypeId', 'inputname': 'inputName',
  'unitprice': 'unitPrice', 'issuedate': 'issueDate', 'totalcost': 'totalCost',
  'grade_code': 'grade_code', 'group_name': 'group_name',
  'quality_level': 'quality_level', 'grade_class': 'grade_class',
  'is_quality_grade': 'is_quality_grade', 'isqualitygrade': 'is_quality_grade',
  'gradeclass': 'grade_class', 'groupname': 'group_name',
  'qualitylevel': 'quality_level', 'gradecode': 'grade_code',
};

const toCamelRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const key of Object.keys(row)) {
    const mapped = PG_COL_MAP[key] ?? PG_COL_MAP[key.toLowerCase()];
    out[mapped || key] = row[key];
  }
  return out;
};

let db;
let sqliteDb;
let pool; // exposed for graceful shutdown

async function initializeDatabase() {
  if (process.env.DATABASE_URL) {
    console.log('[DB] Connecting to PostgreSQL…');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
    });
    pool.on('error', (err) => console.error('[PG POOL] Idle-client error:', err.message));

    db = {
      async execute(sql, params = []) {
        let pgSql = sql;
        let i = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${i++}`);
        const res = await pool.query(pgSql, params);
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          return [res.rows.map(toCamelRow)];
        }
        return [res];
      },
      /** Run multiple statements inside a single transaction */
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({
            async execute(sql, params = []) {
              let pgSql = sql;
              let i = 1;
              pgSql = pgSql.replace(/\?/g, () => `$${i++}`);
              const res = await client.query(pgSql, params);
              if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return [res.rows.map(toCamelRow)];
              }
              return [res];
            }
          });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
    };
    console.log('[DB] Connected to PostgreSQL.');
  } else {
    console.log('[DB] Connecting to SQLite…');
    let sqlite3, openModule;
    try {
      sqlite3 = require('sqlite3').verbose();
      openModule = require('sqlite').open;
    } catch (err) {
      if (err.code === 'ERR_DLOPEN_FAILED') {
        console.error('\n[FATAL] SQLite unavailable in this container. Set DATABASE_URL to use PostgreSQL.\n');
        process.exit(1);
      }
      throw err;
    }

    sqliteDb = await openModule({ filename: './database.sqlite', driver: sqlite3.Database });

    db = {
      async execute(sql, params = []) {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          return [await sqliteDb.all(sql, params)];
        }
        return [await sqliteDb.run(sql, params)];
      },
      async transaction(fn) {
        await sqliteDb.run('BEGIN');
        try {
          const result = await fn(db);
          await sqliteDb.run('COMMIT');
          return result;
        } catch (err) {
          await sqliteDb.run('ROLLBACK');
          throw err;
        }
      }
    };
    console.log('[DB] Connected to SQLite.');
  }

  await createTables();
  await ensureColumnsAndIndexes();
  return db;
}

// ── Schema ───────────────────────────────────────────────────────────────────
async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL, fullName VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL, ps VARCHAR(50) NOT NULL,
      darkMode INTEGER DEFAULT 0, testMode INTEGER DEFAULT 0, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS primary_societies (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS seasons (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL,
      startDate DATE NOT NULL, endDate DATE NOT NULL,
      status VARCHAR(20) NOT NULL, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(36) PRIMARY KEY, grade_code VARCHAR(10) UNIQUE, name VARCHAR(100) NOT NULL,
      group_name VARCHAR(100), category VARCHAR(50), quality_level VARCHAR(50),
      grade_class VARCHAR(50), is_quality_grade INTEGER NOT NULL DEFAULT 1,
      price DECIMAL(10,2) NOT NULL, description TEXT, status VARCHAR(20) NOT NULL, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS market_centers (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL,
      location VARCHAR(255), status VARCHAR(20) NOT NULL, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS farmers (
      id VARCHAR(36) PRIMARY KEY, farmerNumber VARCHAR(20) UNIQUE NOT NULL,
      firstName VARCHAR(50) NOT NULL, middleName VARCHAR(50), lastName VARCHAR(50) NOT NULL,
      gender VARCHAR(10), age INT, village VARCHAR(100) NOT NULL,
      phoneNumber VARCHAR(20), idType VARCHAR(50), idNumber VARCHAR(100),
      hectares DECIMAL(10,2), contractedVolume DECIMAL(10,2), seasonId VARCHAR(36),
      ps VARCHAR(50) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Active',
      createdAt TIMESTAMP NOT NULL, FOREIGN KEY (seasonId) REFERENCES seasons(id))`,
    `CREATE TABLE IF NOT EXISTS input_types (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, category VARCHAR(50) NOT NULL,
      unitPrice DECIMAL(10,2) NOT NULL, unit VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL, createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS issued_inputs (
      id VARCHAR(36) PRIMARY KEY, farmerId VARCHAR(36) NOT NULL, inputTypeId VARCHAR(36) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL, totalCost DECIMAL(10,2) NOT NULL,
      description TEXT, issueDate DATE NOT NULL, ps VARCHAR(50) NOT NULL, createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id), FOREIGN KEY (inputTypeId) REFERENCES input_types(id))`,
    `CREATE TABLE IF NOT EXISTS sale_numbers (
      id VARCHAR(36) PRIMARY KEY, saleNumber VARCHAR(50) NOT NULL,
      marketCenterId VARCHAR(36) NOT NULL, seasonId VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL, ps VARCHAR(50) DEFAULT 'All', createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (seasonId) REFERENCES seasons(id),
      UNIQUE(saleNumber, marketCenterId, seasonId))`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(36) PRIMARY KEY, ticketNumber VARCHAR(50) UNIQUE NOT NULL,
      pcnNumber VARCHAR(50), farmerId VARCHAR(36) NOT NULL, gradeId VARCHAR(36) NOT NULL,
      grade_code VARCHAR(10), marketCenterId VARCHAR(36) NOT NULL, saleNumberId VARCHAR(36) NOT NULL,
      grossWeight DECIMAL(10,2) NOT NULL, tareWeight DECIMAL(10,2) NOT NULL,
      netWeight DECIMAL(10,2) NOT NULL, pricePerKg DECIMAL(10,2) NOT NULL,
      totalValue DECIMAL(10,2) NOT NULL, captureDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL, createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id), FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (saleNumberId) REFERENCES sale_numbers(id))`,
    `CREATE TABLE IF NOT EXISTS pcns (
      id VARCHAR(36) PRIMARY KEY, pcnNumber VARCHAR(50) UNIQUE NOT NULL,
      saleNumber VARCHAR(100) NOT NULL, ps VARCHAR(50) NOT NULL,
      totalFarmers INT NOT NULL DEFAULT 0, totalTickets INT NOT NULL DEFAULT 0,
      totalWeight DECIMAL(10,2) NOT NULL DEFAULT 0, totalValue DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL, closedAt TIMESTAMP, closedBy VARCHAR(100),
      approvedAt TIMESTAMP, approvedBy VARCHAR(100), createdAt TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY, farmerId VARCHAR(36) NOT NULL, pcnId VARCHAR(36),
      tobaccoAmount DECIMAL(10,2) NOT NULL, inputDeduction DECIMAL(10,2) NOT NULL,
      usdBalance DECIMAL(10,2) NOT NULL DEFAULT 0, exchangeRate DECIMAL(10,4) NOT NULL DEFAULT 0,
      tzsGross DECIMAL(14,2) NOT NULL DEFAULT 0, levy DECIMAL(14,2) NOT NULL DEFAULT 0,
      adminFee DECIMAL(14,2) NOT NULL DEFAULT 0, totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0,
      netPayment DECIMAL(14,2) NOT NULL, paymentDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL, createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id), FOREIGN KEY (pcnId) REFERENCES pcns(id))`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL, updatedAt TIMESTAMP NOT NULL)`,
  ];
  for (const sql of tables) {
    try { await db.execute(sql); } catch (e) { console.error('[DB] Table error:', e.message); }
  }
}

// ── Columns + Indexes ────────────────────────────────────────────────────────
async function ensureColumnsAndIndexes() {
  const migrations = [
    // Legacy column additions (idempotent)
    "ALTER TABLE farmers ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE farmers ADD COLUMN middleName VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN gender VARCHAR(10)",
    "ALTER TABLE farmers ADD COLUMN age INT",
    "ALTER TABLE farmers ADD COLUMN hectares DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN contractedVolume DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active'",
    "ALTER TABLE farmers ADD COLUMN idType VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN idNumber VARCHAR(100)",
    "ALTER TABLE farmers ADD COLUMN seasonId VARCHAR(36)",
    "ALTER TABLE issued_inputs ADD COLUMN description TEXT",
    "ALTER TABLE issued_inputs ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE tickets ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE tickets ADD COLUMN pcnNumber VARCHAR(50)",
    "ALTER TABLE payments ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE payments ADD COLUMN usdBalance DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN exchangeRate DECIMAL(10,4) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN tzsGross DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN levy DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN adminFee DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE pcns ADD COLUMN closedAt TIMESTAMP",
    "ALTER TABLE pcns ADD COLUMN closedBy VARCHAR(100)",
    "ALTER TABLE pcns ADD COLUMN approvedAt TIMESTAMP",
    "ALTER TABLE pcns ADD COLUMN approvedBy VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN testMode INTEGER DEFAULT 0",
    "ALTER TABLE grades ADD COLUMN grade_code VARCHAR(10)",
    "ALTER TABLE grades ADD COLUMN group_name VARCHAR(100)",
    "ALTER TABLE grades ADD COLUMN category VARCHAR(50)",
    "ALTER TABLE grades ADD COLUMN quality_level VARCHAR(50)",
    "ALTER TABLE grades ADD COLUMN is_quality_grade INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE tickets ADD COLUMN grade_code VARCHAR(10)",
    "ALTER TABLE grades ADD COLUMN grade_class VARCHAR(50)",
    // ── Performance indexes ────────────────────────────────────────────────────
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_code ON grades(grade_code)",
    "CREATE INDEX IF NOT EXISTS idx_grade_category ON grades(category)",
    "CREATE INDEX IF NOT EXISTS idx_grade_class ON grades(grade_class)",
    // Farmers
    "CREATE INDEX IF NOT EXISTS idx_farmers_ps ON farmers(ps)",
    "CREATE INDEX IF NOT EXISTS idx_farmers_seasonid ON farmers(seasonId)",
    "CREATE INDEX IF NOT EXISTS idx_farmers_status ON farmers(status)",
    // Tickets — the most-queried table
    "CREATE INDEX IF NOT EXISTS idx_tickets_ps ON tickets(ps)",
    "CREATE INDEX IF NOT EXISTS idx_tickets_farmerid ON tickets(farmerId)",
    "CREATE INDEX IF NOT EXISTS idx_tickets_pcnnumber ON tickets(pcnNumber)",
    "CREATE INDEX IF NOT EXISTS idx_tickets_salenumberid ON tickets(saleNumberId)",
    "CREATE INDEX IF NOT EXISTS idx_tickets_capturedate ON tickets(captureDate)",
    "CREATE INDEX IF NOT EXISTS idx_tickets_gradecode ON tickets(grade_code)",
    // Issued inputs
    "CREATE INDEX IF NOT EXISTS idx_issuedinputs_farmerid ON issued_inputs(farmerId)",
    "CREATE INDEX IF NOT EXISTS idx_issuedinputs_ps ON issued_inputs(ps)",
    // Payments
    "CREATE INDEX IF NOT EXISTS idx_payments_farmerid ON payments(farmerId)",
    "CREATE INDEX IF NOT EXISTS idx_payments_ps ON payments(ps)",
    "CREATE INDEX IF NOT EXISTS idx_payments_pcnid ON payments(pcnId)",
    // PCNs
    "CREATE INDEX IF NOT EXISTS idx_pcns_ps ON pcns(ps)",
    "CREATE INDEX IF NOT EXISTS idx_pcns_status ON pcns(status)",
  ];

  for (const sql of migrations) {
    try { await db.execute(sql); } catch (e) {
      const msg = e.message || '';
      const ignored = ['duplicate column', 'already exists', 'column', 'duplicate key'];
      if (!ignored.some(s => msg.toLowerCase().includes(s))) {
        console.error('[DB] Migration warning:', msg);
      }
    }
  }
}

async function closeDatabase() {
  if (pool) await pool.end();
  if (sqliteDb) await sqliteDb.close();
}

module.exports = { initializeDatabase, closeDatabase, getDb: () => db };
