const express = require('express');
const path = require('path');
// SQLite dependencies are required lazily to avoid loading issues in production containers
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let sqliteDb;
let db;

async function initializeDatabase() {
  try {
    if (process.env.DATABASE_URL) {
      console.log('Connecting to PostgreSQL database...');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      db = {
        async execute(sql, params = []) {
          let pgSql = sql;
          let i = 1;
          pgSql = pgSql.replace(/\?/g, () => `$${i++}`);
          const res = await pool.query(pgSql, params);
          if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return [res.rows];
          } else {
            return [res];
          }
        }
      };
      console.log('Connected to PostgreSQL securely.');
    } else {
      console.log('Connecting to SQLite database...');
      let sqlite3, openModule;
      try {
        sqlite3 = require('sqlite3').verbose();
        openModule = require('sqlite').open;
      } catch (err) {
        if (err.code === 'ERR_DLOPEN_FAILED') {
          console.error('\n===================================================================');
          console.error('CRITICAL DEPLOYMENT ERROR: Missing PostgreSQL Connection!');
          console.error('===================================================================');
          console.error('Your application tried to load the local SQLite database because');
          console.error('it could not find the DATABASE_URL environment variable.');
          console.error('');
          console.error('SQLite cannot run natively in this Railway container due to missing');
          console.error('C++ binaries (GLIBC_2.38).');
          console.error('');
          console.error('TO FIX THIS IMMEDIATELY:');
          console.error('1. Go to your Railway Project dashboard.');
          console.error('2. Click on your Web Service (ps-app).');
          console.error('3. Click the "Variables" tab.');
          console.error('4. Click "New Variable" -> "Reference Variable".');
          console.error('5. Select "DATABASE_URL" from your PostgreSQL service.');
          console.error('6. Railway will automatically redeploy and use PostgreSQL!');
          console.error('===================================================================\n');
          process.exit(1);
        }
        throw err;
      }
      
      sqliteDb = await openModule({
        filename: './database.sqlite',
        driver: sqlite3.Database
      });

      db = {
        async execute(sql, params = []) {
          if (sql.trim().toUpperCase().startsWith('SELECT')) {
            const rows = await sqliteDb.all(sql, params);
            return [rows];
          } else {
            const result = await sqliteDb.run(sql, params);
            return [result];
          }
        }
      };
      console.log('Connected to SQLite securely.');
    }

    await createTables();
    await ensureColumns();
    await createDefaultPrimarySocieties();
    await createDefaultAdmin();
    await repairMissingSaleNumberIds();
    await populatePCNsFromTickets();
    await syncGradesFromMaster();

  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

async function repairMissingSaleNumberIds() {
  try {
    const [rows] = await db.execute("SELECT COUNT(*) as count FROM tickets WHERE saleNumberId = '' OR saleNumberId IS NULL");
    if (rows[0].count > 0) {
      console.log(`Repairing ${rows[0].count} tickets with missing saleNumberId...`);
      
      // Stage 1: Sync within same PCN (if some tickets have ID but others don't)
      await db.execute(`
        UPDATE tickets 
        SET saleNumberId = (
          SELECT t2.saleNumberId 
          FROM tickets t2 
          WHERE t2.pcnNumber = tickets.pcnNumber 
          AND t2.saleNumberId != '' 
          AND t2.saleNumberId IS NOT NULL
          LIMIT 1
        )
        WHERE (saleNumberId = '' OR saleNumberId IS NULL)
        AND pcnNumber IS NOT NULL
        AND EXISTS (
          SELECT 1 
          FROM tickets t2 
          WHERE t2.pcnNumber = tickets.pcnNumber 
          AND t2.saleNumberId != '' 
          AND t2.saleNumberId IS NOT NULL
        )
      `);

      // Stage 2: Sync via PCN table and sale_numbers mapping
      await db.execute(`
        UPDATE tickets 
        SET saleNumberId = (
          SELECT sn.id 
          FROM sale_numbers sn 
          JOIN pcns p ON p.saleNumber = sn.saleNumber 
          WHERE p.pcnNumber = tickets.pcnNumber
          LIMIT 1
        )
        WHERE (saleNumberId = '' OR saleNumberId IS NULL)
        AND pcnNumber IS NOT NULL
        AND EXISTS (
          SELECT 1 
          FROM sale_numbers sn 
          JOIN pcns p ON p.saleNumber = sn.saleNumber 
          WHERE p.pcnNumber = tickets.pcnNumber
        )
      `);
      console.log('Ticket repair complete.');
    }
  } catch (e) {
    console.warn('Ticket repair failed (this may be normal if PCN table is empty):', e.message);
  }
}

async function syncPCNRecord(pcnNumber, saleNumberId, effectivePs) {
  if (!pcnNumber) return;
  try {
    // 1. Get Sale Number string if possible
    let saleNumberStr = '';
    if (saleNumberId) {
      const [snRows] = await db.execute('SELECT saleNumber FROM sale_numbers WHERE id = ?', [saleNumberId]);
      if (snRows.length > 0) saleNumberStr = snRows[0].saleNumber;
    }

    // 2. Calculate totals from tickets
    const [totals] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM tickets WHERE pcnNumber = ?) as totalTickets,
        SUM(CASE WHEN g.is_quality_grade = 1 THEN t.netWeight ELSE 0 END) as totalWeight,
        SUM(CASE WHEN g.is_quality_grade = 1 THEN t.totalValue ELSE 0 END) as totalValue,
        COUNT(DISTINCT CASE WHEN g.is_quality_grade = 1 THEN t.farmerId ELSE NULL END) as totalFarmers,
        MAX(t.ps) as latestPs,
        MAX(t.saleNumberId) as latestSnId
      FROM tickets t
      LEFT JOIN grades g ON t.grade_code = g.grade_code
      WHERE t.pcnNumber = ?
    `, [pcnNumber, pcnNumber]);

    const stats = totals[0];
    if (!stats || stats.totalTickets === 0) {
      await db.execute('DELETE FROM pcns WHERE pcnNumber = ?', [pcnNumber]);
      return;
    }

    if (!saleNumberStr && stats.latestSnId) {
      const [snRows] = await db.execute('SELECT saleNumber FROM sale_numbers WHERE id = ?', [stats.latestSnId]);
      if (snRows.length > 0) saleNumberStr = snRows[0].saleNumber;
    }

    const finalPs = (effectivePs && effectivePs !== 'All') ? effectivePs : (stats.latestPs || 'All');

    const [existing] = await db.execute('SELECT id FROM pcns WHERE pcnNumber = ?', [pcnNumber]);
    if (existing.length > 0) {
      await db.execute(`
        UPDATE pcns SET 
          totalTickets = ?, 
          totalWeight = ?, 
          totalValue = ?, 
          totalFarmers = ?,
          saleNumber = COALESCE(NULLIF(?, ''), saleNumber),
          ps = ?
        WHERE pcnNumber = ?
      `, [stats.totalTickets, stats.totalWeight || 0, stats.totalValue || 0, stats.totalFarmers || 0, saleNumberStr, finalPs, pcnNumber]);
    } else {
      const id = uuidv4();
      await db.execute(`
        INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)
      `, [id, pcnNumber, saleNumberStr || 'TBD', finalPs, stats.totalFarmers || 0, stats.totalTickets, stats.totalWeight || 0, stats.totalValue || 0, 
          new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    }
  } catch (e) {
    console.error('Error syncing PCN record:', e);
  }
}

async function syncGradesFromMaster() {
  const MASTER_GRADES = [
    { code: 'X1L', group: 'LUGS_LEMON', cat: 'LUGS', q: 'Choice', p: 2.370, cls: 'STANDARD', is_q: 1 },
    { code: 'X2L', group: 'LUGS_LEMON', cat: 'LUGS', q: 'Fine', p: 2.112, cls: 'STANDARD', is_q: 1 },
    { code: 'X3L', group: 'LUGS_LEMON', cat: 'LUGS', q: 'Good', p: 1.474, cls: 'STANDARD', is_q: 1 },
    { code: 'X4L', group: 'LUGS_LEMON', cat: 'LUGS', q: 'Fair', p: 0.891, cls: 'STANDARD', is_q: 1 },
    { code: 'X5L', group: 'LUGS_LEMON', cat: 'LUGS', q: 'Low', p: 0.555, cls: 'STANDARD', is_q: 1 },
    { code: 'X1O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Choice', p: 2.405, cls: 'STANDARD', is_q: 1 },
    { code: 'X2O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Fine', p: 2.225, cls: 'STANDARD', is_q: 1 },
    { code: 'X3O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Good', p: 1.588, cls: 'STANDARD', is_q: 1 },
    { code: 'X4O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Fair', p: 0.939, cls: 'STANDARD', is_q: 1 },
    { code: 'X5O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Low', p: 0.590, cls: 'STANDARD', is_q: 1 },
    { code: 'X6O', group: 'LUGS_ORANGE', cat: 'LUGS', q: 'Reject', p: 0.250, cls: 'REJECT', is_q: 1 },
    { code: 'XLV', group: 'LUGS_VAR', cat: 'LUGS', q: 'Low', p: 0.579, cls: 'STANDARD', is_q: 1 },
    { code: 'XOV', group: 'LUGS_VAR', cat: 'LUGS', q: 'Low', p: 0.634, cls: 'STANDARD', is_q: 1 },
    { code: 'XND', group: 'NON_DESCRIPT', cat: 'LUGS', q: 'Reject', p: 0.164, cls: 'REJECT', is_q: 1 },
    { code: 'XG', group: 'LUGS_REJECT', cat: 'LUGS', q: 'Reject', p: 0.391, cls: 'REJECT', is_q: 1 },
    { code: 'C1L', group: 'CUTTERS_LEMON', cat: 'CUTTERS', q: 'Choice', p: 2.632, cls: 'STANDARD', is_q: 1 },
    { code: 'C2L', group: 'CUTTERS_LEMON', cat: 'CUTTERS', q: 'Fine', p: 2.383, cls: 'STANDARD', is_q: 1 },
    { code: 'C3L', group: 'CUTTERS_LEMON', cat: 'CUTTERS', q: 'Good', p: 1.795, cls: 'STANDARD', is_q: 1 },
    { code: 'C4L', group: 'CUTTERS_LEMON', cat: 'CUTTERS', q: 'Fair', p: 1.262, cls: 'STANDARD', is_q: 1 },
    { code: 'C5L', group: 'CUTTERS_LEMON', cat: 'CUTTERS', q: 'Low', p: 0.604, cls: 'STANDARD', is_q: 1 },
    { code: 'C1O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Choice', p: 2.753, cls: 'STANDARD', is_q: 1 },
    { code: 'C2O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Fine', p: 2.556, cls: 'STANDARD', is_q: 1 },
    { code: 'C3O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Good', p: 1.870, cls: 'STANDARD', is_q: 1 },
    { code: 'C4O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Fair', p: 1.368, cls: 'STANDARD', is_q: 1 },
    { code: 'C5O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Low', p: 0.654, cls: 'STANDARD', is_q: 1 },
    { code: 'C6O', group: 'CUTTERS_ORANGE', cat: 'CUTTERS', q: 'Reject', p: 0.469, cls: 'REJECT', is_q: 1 },
    { code: 'L1L', group: 'LEAF_LEMON', cat: 'LEAF', q: 'Choice', p: 3.185, cls: 'STANDARD', is_q: 1 },
    { code: 'L2L', group: 'LEAF_LEMON', cat: 'LEAF', q: 'Fine', p: 2.843, cls: 'STANDARD', is_q: 1 },
    { code: 'L3L', group: 'LEAF_LEMON', cat: 'LEAF', q: 'Good', p: 2.246, cls: 'STANDARD', is_q: 1 },
    { code: 'L4L', group: 'LEAF_LEMON', cat: 'LEAF', q: 'Fair', p: 1.748, cls: 'STANDARD', is_q: 1 },
    { code: 'L5L', group: 'LEAF_LEMON', cat: 'LEAF', q: 'Low', p: 1.240, cls: 'STANDARD', is_q: 1 },
    { code: 'L1O', group: 'LEAF_ORANGE', cat: 'LEAF', q: 'Choice', p: 3.268, cls: 'STANDARD', is_q: 1 },
    { code: 'L2O', group: 'LEAF_ORANGE', cat: 'LEAF', q: 'Fine', p: 3.130, cls: 'STANDARD', is_q: 1 },
    { code: 'L3O', group: 'LEAF_ORANGE', cat: 'LEAF', q: 'Good', p: 2.688, cls: 'STANDARD', is_q: 1 },
    { code: 'L4O', group: 'LEAF_ORANGE', cat: 'LEAF', q: 'Fair', p: 1.900, cls: 'STANDARD', is_q: 1 },
    { code: 'L5O', group: 'LEAF_ORANGE', cat: 'LEAF', q: 'Low', p: 1.378, cls: 'STANDARD', is_q: 1 },
    { code: 'L1R', group: 'LEAF_RED', cat: 'LEAF', q: 'Choice', p: 3.176, cls: 'STANDARD', is_q: 1 },
    { code: 'L2R', group: 'LEAF_RED', cat: 'LEAF', q: 'Fine', p: 2.763, cls: 'STANDARD', is_q: 1 },
    { code: 'L3R', group: 'LEAF_RED', cat: 'LEAF', q: 'Good', p: 2.012, cls: 'STANDARD', is_q: 1 },
    { code: 'L4R', group: 'LEAF_RED', cat: 'LEAF', q: 'Fair', p: 1.441, cls: 'STANDARD', is_q: 1 },
    { code: 'L5R', group: 'LEAF_RED', cat: 'LEAF', q: 'Low', p: 1.072, cls: 'STANDARD', is_q: 1 },
    { code: 'LLV', group: 'LEAF_VAR', cat: 'LEAF', q: 'Low', p: 0.950, cls: 'STANDARD', is_q: 1 },
    { code: 'LOV', group: 'LEAF_VAR', cat: 'LEAF', q: 'Low', p: 1.094, cls: 'STANDARD', is_q: 1 },
    { code: 'LND', group: 'NON_DESCRIPT', cat: 'LEAF', q: 'Reject', p: 0.261, cls: 'REJECT', is_q: 1 },
    { code: 'LG', group: 'LEAF_REJECT', cat: 'LEAF', q: 'Reject', p: 0.391, cls: 'REJECT', is_q: 1 },
    { code: 'B1L', group: 'BRIGHT_LEAF', cat: 'LEAF', q: 'Choice', p: 0.519, cls: 'SPECIAL', is_q: 1 },
    { code: 'B1O', group: 'BRIGHT_LEAF', cat: 'LEAF', q: 'Choice', p: 0.571, cls: 'SPECIAL', is_q: 1 },
    { code: 'LK', group: 'LEAF_VAR', cat: 'LEAF', q: 'Low', p: 0.589, cls: 'SPECIAL', is_q: 1 },
    { code: 'M1L', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Choice', p: 3.010, cls: 'STANDARD', is_q: 1 },
    { code: 'M2L', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fine', p: 2.600, cls: 'STANDARD', is_q: 1 },
    { code: 'M3L', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Good', p: 1.973, cls: 'STANDARD', is_q: 1 },
    { code: 'M4L', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fair', p: 1.385, cls: 'STANDARD', is_q: 1 },
    { code: 'M5L', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Low', p: 1.058, cls: 'STANDARD', is_q: 1 },
    { code: 'M1O', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Choice', p: 3.163, cls: 'STANDARD', is_q: 1 },
    { code: 'M2O', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fine', p: 2.917, cls: 'STANDARD', is_q: 1 },
    { code: 'M3O', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Good', p: 2.324, cls: 'STANDARD', is_q: 1 },
    { code: 'M4O', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fair', p: 1.731, cls: 'STANDARD', is_q: 1 },
    { code: 'M5O', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Low', p: 1.229, cls: 'STANDARD', is_q: 1 },
    { code: 'M1R', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Choice', p: 2.841, cls: 'STANDARD', is_q: 1 },
    { code: 'M2R', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fine', p: 2.720, cls: 'STANDARD', is_q: 1 },
    { code: 'M3R', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Good', p: 1.895, cls: 'STANDARD', is_q: 1 },
    { code: 'M4R', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Fair', p: 1.396, cls: 'STANDARD', is_q: 1 },
    { code: 'M5R', group: 'SMOKING_LEAF', cat: 'SMOKING_LEAF', q: 'Low', p: 0.969, cls: 'STANDARD', is_q: 1 },
    { code: 'L1OF', group: 'LEAF_ORANGE_FULL', cat: 'LEAF', q: 'Choice', p: 3.320, cls: 'PREMIUM', is_q: 1 },
    { code: 'L2OF', group: 'LEAF_ORANGE_FULL', cat: 'LEAF', q: 'Fine', p: 3.240, cls: 'PREMIUM', is_q: 1 },
    { code: 'L3OF', group: 'LEAF_ORANGE_FULL', cat: 'LEAF', q: 'Good', p: 2.860, cls: 'PREMIUM', is_q: 1 },
    { code: 'REJ', group: 'REJECT', cat: 'REJECT', q: 'Reject', p: 0, cls: 'REJECT', is_q: 1 },
    { code: 'CAN', group: 'PROCESS', cat: 'PROCESS', q: 'None', p: 0, cls: 'PROCESS', is_q: 0 },
    { code: 'WIT', group: 'PROCESS', cat: 'PROCESS', q: 'None', p: 0, cls: 'PROCESS', is_q: 0 }
  ];

  try {
    console.log('Synchronizing grade prices from master list...');
    for (const g of MASTER_GRADES) {
      const masterPrice = (g.p ?? g.price);
      const [existing] = await db.execute('SELECT id FROM grades WHERE grade_code = ?', [g.code]);
      if (existing.length > 0) {
        await db.execute('UPDATE grades SET price = ? WHERE grade_code = ?', [masterPrice, g.code]);
      } else {
        const id = uuidv4();
        await db.execute(`INSERT INTO grades (id, name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade, createdAt)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, g.code, masterPrice, `Master Grade ${g.code}`, 'Active', g.code, g.group, g.cat || g.category, g.q || g.quality, g.cls || g.grade_class || 'STANDARD', g.is_q ?? 1,
           new Date().toISOString().slice(0, 19).replace('T', ' ')]);
      }
    }
    console.log('Grade synchronization complete.');
  } catch (e) {
    console.error('Error synchronizing grades:', e.message);
  }
}

async function populatePCNsFromTickets() {
  try {
    const [rows] = await db.execute("SELECT DISTINCT pcnNumber, saleNumberId, ps FROM tickets WHERE pcnNumber IS NOT NULL AND pcnNumber != ''");
    if (rows.length > 0) {
      console.log(`Synchronizing ${rows.length} PCNs from existing tickets...`);
      for (const row of rows) {
        await syncPCNRecord(row.pcnNumber, row.saleNumberId, row.ps);
      }
      console.log('PCN synchronization complete.');
    }
  } catch (e) {
    console.error('Error populating PCNs from tickets:', e.message);
  }
}

async function createDefaultPrimarySocieties() {
  try {
    const existing = await db.execute('SELECT id FROM primary_societies LIMIT 1');
    if (existing[0].length === 0) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const defaultPS = [
        { id: uuidv4(), name: 'Default Society', code: 'DEFAULT', status: 'Active' },
        { id: uuidv4(), name: 'Society A', code: 'A', status: 'Active' },
        { id: uuidv4(), name: 'Society B', code: 'B', status: 'Active' }
      ];
      for (const ps of defaultPS) {
        await db.execute(`INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [ps.id, ps.name, ps.code, ps.status, now]);
      }
      console.log('Default primary societies created');
    }
  } catch (error) {
    console.error('Error creating default primary societies:', error.message);
  }
}

async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      fullName VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      ps VARCHAR(50) NOT NULL,
      darkMode INTEGER DEFAULT 0,
      testMode INTEGER DEFAULT 0,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS primary_societies (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS seasons (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      startDate DATE NOT NULL,
      endDate DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(36) PRIMARY KEY,
      grade_code VARCHAR(10) UNIQUE,
      name VARCHAR(100) NOT NULL,
      group_name VARCHAR(100),
      category VARCHAR(50),
      quality_level VARCHAR(50),
      grade_class VARCHAR(50),
      is_quality_grade INTEGER NOT NULL DEFAULT 1,
      price DECIMAL(10,2) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS market_centers (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      location VARCHAR(255),
      status VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS farmers (
      id VARCHAR(36) PRIMARY KEY,
      farmerNumber VARCHAR(20) UNIQUE NOT NULL,
      firstName VARCHAR(50) NOT NULL,
      middleName VARCHAR(50),
      lastName VARCHAR(50) NOT NULL,
      gender VARCHAR(10),
      age INT,
      village VARCHAR(100) NOT NULL,
      phoneNumber VARCHAR(20),
      idType VARCHAR(50),
      idNumber VARCHAR(100),
      hectares DECIMAL(10,2),
      contractedVolume DECIMAL(10,2),
      seasonId VARCHAR(36),
      ps VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (seasonId) REFERENCES seasons(id)
    )`,
    `CREATE TABLE IF NOT EXISTS input_types (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      unitPrice DECIMAL(10,2) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS issued_inputs (
      id VARCHAR(36) PRIMARY KEY,
      farmerId VARCHAR(36) NOT NULL,
      inputTypeId VARCHAR(36) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      totalCost DECIMAL(10,2) NOT NULL,
      description TEXT,
      issueDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (inputTypeId) REFERENCES input_types(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sale_numbers (
      id VARCHAR(36) PRIMARY KEY,
      saleNumber VARCHAR(50) NOT NULL,
      marketCenterId VARCHAR(36) NOT NULL,
      seasonId VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL,
      ps VARCHAR(50) DEFAULT 'All',
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (seasonId) REFERENCES seasons(id),
      UNIQUE(saleNumber, marketCenterId, seasonId)
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(36) PRIMARY KEY,
      ticketNumber VARCHAR(50) UNIQUE NOT NULL,
      pcnNumber VARCHAR(50),
      farmerId VARCHAR(36) NOT NULL,
      gradeId VARCHAR(36) NOT NULL,
      grade_code VARCHAR(10),
      marketCenterId VARCHAR(36) NOT NULL,
      saleNumberId VARCHAR(36) NOT NULL,
      grossWeight DECIMAL(10,2) NOT NULL,
      tareWeight DECIMAL(10,2) NOT NULL,
      netWeight DECIMAL(10,2) NOT NULL,
      pricePerKg DECIMAL(10,2) NOT NULL,
      totalValue DECIMAL(10,2) NOT NULL,
      captureDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (saleNumberId) REFERENCES sale_numbers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pcns (
      id VARCHAR(36) PRIMARY KEY,
      pcnNumber VARCHAR(50) UNIQUE NOT NULL,
      saleNumber VARCHAR(100) NOT NULL,
      ps VARCHAR(50) NOT NULL,
      totalFarmers INT NOT NULL DEFAULT 0,
      totalTickets INT NOT NULL DEFAULT 0,
      totalWeight DECIMAL(10,2) NOT NULL DEFAULT 0,
      totalValue DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL,
      closedAt TIMESTAMP,
      closedBy VARCHAR(100),
      approvedAt TIMESTAMP,
      approvedBy VARCHAR(100),
      createdAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY,
      farmerId VARCHAR(36) NOT NULL,
      pcnId VARCHAR(36),
      tobaccoAmount DECIMAL(10,2) NOT NULL,
      inputDeduction DECIMAL(10,2) NOT NULL,
      usdBalance DECIMAL(10,2) NOT NULL DEFAULT 0,
      exchangeRate DECIMAL(10,4) NOT NULL DEFAULT 0,
      tzsGross DECIMAL(14,2) NOT NULL DEFAULT 0,
      levy DECIMAL(14,2) NOT NULL DEFAULT 0,
      adminFee DECIMAL(14,2) NOT NULL DEFAULT 0,
      totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0,
      netPayment DECIMAL(14,2) NOT NULL,
      paymentDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (pcnId) REFERENCES pcns(id)
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TIMESTAMP NOT NULL
    )`
  ];

  for (const sql of tables) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.error('Error creating table:', error.message);
    }
  }
}

async function ensureColumns() {
  const alterations = [
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
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_code ON grades(grade_code)",
    "CREATE INDEX IF NOT EXISTS idx_grade_category ON grades(category)",
    "ALTER TABLE tickets ADD COLUMN grade_code VARCHAR(10)",
    "ALTER TABLE grades ADD COLUMN grade_class VARCHAR(50)",
    "CREATE INDEX IF NOT EXISTS idx_grade_class ON grades(grade_class)"
  ];

  for (const sql of alterations) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (!error.message.includes('duplicate column name') && 
          !error.message.includes('column') && 
          !error.message.includes('already exists')) {
        console.error('Error adding column:', error.message);
      }
    }
  }
}

async function createDefaultAdmin() {
  try {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminUser = {
      id: uuidv4(),
      username: 'admin',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'Supervisor',
      ps: 'All',
      darkMode: 0,
      testMode: 0,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, adminUser.username, adminUser.password, adminUser.fullName,
         adminUser.role, adminUser.ps, adminUser.darkMode, adminUser.testMode, adminUser.createdAt]);
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

initializeDatabase();

// Helper: is user a supervisor/admin?
function isSupervisor(user) {
  return user.role === 'Supervisor' || user.role === 'Admin';
}

function canAccessPs(user, recordPs) {
  if (isSupervisor(user)) {
    return true;
  }

  const userPs = user?.ps || 'All';
  return recordPs === 'All' || recordPs === userPs;
}

async function getFarmerById(farmerId) {
  const [rows] = await db.execute('SELECT * FROM farmers WHERE id = ?', [farmerId]);
  return rows[0] || null;
}

// Auth middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.execute(
      'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// ─── PRIMARY SOCIETIES ───────────────────────────────────────────────────────

app.get('/api/ps', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM primary_societies ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Get PS error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ps', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, code, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, name, code, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, code, status: status || 'Active' });
  } catch (error) {
    console.error('Create PS error:', error);
    res.status(500).json({ error: 'Error creating primary society' });
  }
});

app.put('/api/ps/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, code, status } = req.body;
    await db.execute('UPDATE primary_societies SET name=?, code=?, status=? WHERE id=?',
      [name, code, status, req.params.id]);
    res.json({ id: req.params.id, name, code, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating society' });
  }
});

app.delete('/api/ps/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM primary_societies WHERE id=?', [req.params.id]);
    res.json({ message: 'Society deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting society' });
  }
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, ps: user.ps },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        ps: user.ps,
        darkMode: Boolean(user.darkMode),
        testMode: Boolean(user.testMode)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, ps } = req.body;
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const role = 'Clerk';
    const effectivePs = ps || 'All';

    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role, effectivePs, 0, 0,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    const token = jwt.sign({ id, username, role, ps: effectivePs }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id, username, fullName, role, ps: effectivePs, darkMode: false, testMode: false } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const query = supervisor
      ? 'SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users'
      : "SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users WHERE ps = 'All' OR ps = ?";
    const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { username, password, fullName, role, ps } = req.body;
    const effectivePs = isSupervisor(req.user) ? (ps || 'All') : req.user.ps;

    const [psRows] = await db.execute('SELECT id FROM primary_societies WHERE code = ?', [effectivePs]);
    if (psRows.length === 0 && effectivePs !== 'All') {
      return res.status(400).json({ error: 'Invalid Primary Society code' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role || 'Clerk', effectivePs, 0, 0,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, username, fullName, role: role || 'Clerk', ps: effectivePs });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isSelf = req.user.id === targetId;
    const supervisor = isSupervisor(req.user);

    // Only supervisors can update other users; anyone can update their own prefs
    if (!supervisor && !isSelf) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { fullName, role, ps, password, darkMode, testMode } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (fullName !== undefined) { updates.push('fullName = ?'); params.push(fullName); }
    if (darkMode !== undefined) { updates.push('darkMode = ?'); params.push(darkMode ? 1 : 0); }
    if (testMode !== undefined && supervisor) { updates.push('testMode = ?'); params.push(testMode ? 1 : 0); }
    if (role !== undefined && supervisor) { updates.push('role = ?'); params.push(role); }
    if (ps !== undefined && supervisor) { updates.push('ps = ?'); params.push(ps); }
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) return res.json({ message: 'Nothing to update' });

    params.push(targetId);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Return updated user
    const [rows] = await db.execute(
      'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?',
      [targetId]
    );
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const [rows] = await db.execute('SELECT username FROM users WHERE id = ?', [req.params.id]);
    if (rows.length > 0 && rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin' });
    }
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// ─── SEASONS ─────────────────────────────────────────────────────────────────

app.get('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM seasons ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO seasons (id, name, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, startDate, endDate, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, startDate, endDate, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating season' });
  }
});

app.put('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    await db.execute(`UPDATE seasons SET name=?, startDate=?, endDate=?, status=? WHERE id=?`,
      [name, startDate, endDate, status, req.params.id]);
    res.json({ id: req.params.id, name, startDate, endDate, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating season' });
  }
});

app.delete('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM seasons WHERE id=?', [req.params.id]);
    res.json({ message: 'Season deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting season' });
  }
});

// ─── GRADES ──────────────────────────────────────────────────────────────────

app.get('/api/grades', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM grades ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/grades', authenticateToken, async (req, res) => {
  try {
    const { name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade } = req.body;
    
    // Premium Grade Validation
    if (grade_code && ['L1OF', 'L2OF', 'L3OF'].includes(grade_code)) {
      if (group_name !== 'LEAF_ORANGE_FULL' || category !== 'LEAF') {
        return res.status(400).json({ error: 'Premium grades (L-OF) must be in group LEAF_ORANGE_FULL and category LEAF' });
      }
    } else if (grade_code && grade_code.startsWith('L') && grade_code.includes('O')) {
      if (group_name === 'LEAF_ORANGE_FULL') {
        return res.status(400).json({ error: 'Standard orange leaf cannot be in LEAF_ORANGE_FULL' });
      }
    }
    const id = uuidv4();
    await db.execute(`INSERT INTO grades (id, name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, price, description, status || 'Active', grade_code, group_name, category, quality_level, grade_class, is_quality_grade ?? 1,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, price, description, status: status || 'Active', grade_code, group_name, category, quality_level, grade_class, is_quality_grade: is_quality_grade ?? 1 });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed: grades.grade_code')) {
      return res.status(409).json({ error: 'Grade code already exists' });
    }
    console.error('Create grade error:', error);
    res.status(500).json({ error: 'Error creating grade' });
  }
});

app.put('/api/grades/:id', authenticateToken, async (req, res) => {
  try {
    const { name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade } = req.body;

    // Premium Grade Validation
    if (grade_code && ['L1OF', 'L2OF', 'L3OF'].includes(grade_code)) {
      if (group_name !== 'LEAF_ORANGE_FULL' || category !== 'LEAF') {
        return res.status(400).json({ error: 'Premium grades (L-OF) must be in group LEAF_ORANGE_FULL and category LEAF' });
      }
    } else if (grade_code && grade_code.startsWith('L') && grade_code.includes('O')) {
      if (group_name === 'LEAF_ORANGE_FULL') {
        return res.status(400).json({ error: 'Standard orange leaf cannot be in LEAF_ORANGE_FULL' });
      }
    }
    await db.execute(`UPDATE grades SET name=?, price=?, description=?, status=?, grade_code=?, group_name=?, category=?, quality_level=?, grade_class=?, is_quality_grade=?
                      WHERE id=?`,
      [name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade ?? 1, req.params.id]);
    res.json({ id: req.params.id, name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade: is_quality_grade ?? 1 });
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ error: 'Error updating grade' });
  }
});

app.delete('/api/grades/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM grades WHERE id=?', [req.params.id]);
    res.json({ message: 'Grade deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting grade' });
  }
});

// ─── MARKET CENTERS ──────────────────────────────────────────────────────────

app.get('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM market_centers ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const { name, location, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO market_centers (id, name, location, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, name, location, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, location, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating market center' });
  }
});

app.put('/api/market-centers/:id', authenticateToken, async (req, res) => {
  try {
    const { name, location, status } = req.body;
    await db.execute('UPDATE market_centers SET name=?, location=?, status=? WHERE id=?',
      [name, location, status, req.params.id]);
    res.json({ id: req.params.id, name, location, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating market center' });
  }
});

app.delete('/api/market-centers/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM market_centers WHERE id=?', [req.params.id]);
    res.json({ message: 'Market center deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting market center' });
  }
});

// ─── FARMERS ─────────────────────────────────────────────────────────────────

app.get('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT f.*, s.name as seasonName
                       FROM farmers f
                       LEFT JOIN seasons s ON f.seasonId = s.id`;
    const whereClause = supervisor ? '' : " WHERE f.ps = 'All' OR f.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY f.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const { farmerNumber, firstName, middleName, lastName, gender, age, village,
            phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO farmers (id, farmerNumber, firstName, middleName, lastName, gender, age,
                       village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, ps, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerNumber, firstName, middleName, lastName, gender, age, village,
       phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
       effectivePs, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerNumber, firstName, middleName, lastName, gender, age, village,
               phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
               status: status || 'Active', ps: effectivePs });
  } catch (error) {
    console.error('Create farmer error:', error);
    res.status(500).json({ error: 'Error creating farmer' });
  }
});

app.put('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    const { firstName, middleName, lastName, gender, age, village, phoneNumber,
            idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;
    const existingFarmer = await getFarmerById(req.params.id);

    if (!existingFarmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    if (!canAccessPs(req.user, existingFarmer.ps)) {
      return res.status(403).json({ error: 'Access denied for this farmer' });
    }

    await db.execute(`UPDATE farmers SET firstName=?, middleName=?, lastName=?, gender=?, age=?, village=?,
                       phoneNumber=?, idType=?, idNumber=?, hectares=?, contractedVolume=?, seasonId=?, ps=?, status=?
                      WHERE id=?`,
      [firstName, middleName, lastName, gender, age, village, phoneNumber,
       idType, idNumber, hectares, contractedVolume, seasonId, effectivePs, status || 'Active', req.params.id]);

    res.json({ id: req.params.id, firstName, middleName, lastName, gender, age, village,
               phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps: effectivePs });
  } catch (error) {
    res.status(500).json({ error: 'Error updating farmer' });
  }
});

app.delete('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    const farmer = await getFarmerById(req.params.id);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    if (!isSupervisor(req.user) && !canAccessPs(req.user, farmer.ps)) {
      return res.status(403).json({ error: 'Access denied for this farmer' });
    }

    await db.execute('DELETE FROM farmers WHERE id=?', [req.params.id]);
    res.json({ message: 'Farmer deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting farmer' });
  }
});

// ─── INPUT TYPES ─────────────────────────────────────────────────────────────

app.get('/api/input-types', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM input_types ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/input-types', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, category, unitPrice, unit, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO input_types (id, name, category, unitPrice, unit, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, unitPrice, unit, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, category, unitPrice, unit, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating input type' });
  }
});

app.put('/api/input-types/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, category, unitPrice, unit, status } = req.body;
    await db.execute('UPDATE input_types SET name=?, category=?, unitPrice=?, unit=?, status=? WHERE id=?',
      [name, category, unitPrice, unit, status, req.params.id]);
    res.json({ id: req.params.id, name, category, unitPrice, unit, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating input type' });
  }
});

app.delete('/api/input-types/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM input_types WHERE id=?', [req.params.id]);
    res.json({ message: 'Input type deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting input type' });
  }
});

// ─── ISSUED INPUTS ────────────────────────────────────────────────────────────

app.get('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT ii.*, f.farmerNumber, f.firstName, f.lastName, it.name as inputName
                       FROM issued_inputs ii
                       JOIN farmers f ON ii.farmerId = f.id
                       JOIN input_types it ON ii.inputTypeId = it.id`;
    const whereClause = supervisor ? '' : " WHERE ii.ps = 'All' OR ii.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY ii.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const { farmerId, inputTypeId, quantity, totalCost, description, issueDate, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    if (!supervisor) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id=?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to issue inputs for this farmer' });
      }
    }

    await db.execute(`INSERT INTO issued_inputs (id, farmerId, inputTypeId, quantity, totalCost, description, issueDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, inputTypeId, quantity, totalCost, description || null, issueDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps: effectivePs });
  } catch (error) {
    res.status(500).json({ error: 'Error issuing input' });
  }
});

app.delete('/api/issued-inputs/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM issued_inputs WHERE id=?', [req.params.id]);
    res.json({ message: 'Input deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting issued input' });
  }
});

// ─── SALE NUMBERS ────────────────────────────────────────────────────────────

app.get('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT sn.*, mc.name as marketCenterName, s.name as seasonName
                                     FROM sale_numbers sn
                                     JOIN market_centers mc ON sn.marketCenterId = mc.id
                                     JOIN seasons s ON sn.seasonId = s.id
                                     ORDER BY sn.createdAt DESC`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const { saleNumber, marketCenterId, seasonId, status, ps } = req.body;
    const id = uuidv4();
    const finalPs = ps || 'All';
    await db.execute(`INSERT INTO sale_numbers (id, saleNumber, marketCenterId, seasonId, status, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, saleNumber, marketCenterId, seasonId, status || 'Active', finalPs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, saleNumber, marketCenterId, seasonId, status: status || 'Active', ps: finalPs });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This sale number already exists for the selected market center and season' });
    }
    res.status(500).json({ error: 'Error creating sale number' });
  }
});

app.put('/api/sale-numbers/:id', authenticateToken, async (req, res) => {
  try {
    const { saleNumber, marketCenterId, seasonId, status, ps } = req.body;
    const finalPs = ps || 'All';
    await db.execute('UPDATE sale_numbers SET saleNumber=?, marketCenterId=?, seasonId=?, status=?, ps=? WHERE id=?',
      [saleNumber, marketCenterId, seasonId, status, finalPs, req.params.id]);
    res.json({ id: req.params.id, saleNumber, marketCenterId, seasonId, status, ps: finalPs });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This sale number already exists for the selected market center and season' });
    }
    res.status(500).json({ error: 'Error updating sale number' });
  }
});

app.delete('/api/sale-numbers/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM sale_numbers WHERE id=?', [req.params.id]);
    res.json({ message: 'Sale number deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting sale number' });
  }
});

// ─── TICKETS ─────────────────────────────────────────────────────────────────

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
                               g.name as gradeName, g.grade_code as gCode, g.category as gradeCategory, g.quality_level as gradeLevel,
                               mc.name as marketCenterName, sn.saleNumber
                       FROM tickets t
                       JOIN farmers f ON t.farmerId = f.id
                       JOIN grades g ON t.gradeId = g.id
                       JOIN market_centers mc ON t.marketCenterId = mc.id
                       JOIN sale_numbers sn ON t.saleNumberId = sn.id`;
    const whereClause = supervisor ? '' : " WHERE t.ps = 'All' OR t.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY t.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Check if a ticket number exists (for duplicate detection)
app.get('/api/tickets/check/:ticketNumber', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const whereClause = supervisor ? 'WHERE t.ticketNumber = ?' : "WHERE t.ticketNumber = ? AND (t.ps = 'All' OR t.ps = ?)";
    const params = supervisor ? [req.params.ticketNumber] : [req.params.ticketNumber, psFilter];

    const [rows] = await db.execute(
      `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
              g.name as gradeName, g.grade_code as gCode, mc.name as marketCenterName, sn.saleNumber
       FROM tickets t
       JOIN farmers f ON t.farmerId = f.id
       JOIN grades g ON t.gradeId = g.id
       JOIN market_centers mc ON t.marketCenterId = mc.id
       JOIN sale_numbers sn ON t.saleNumberId = sn.id
       ${whereClause}`,
      params
    );
    if (rows.length > 0) {
      res.json({ exists: true, ticket: rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId, saleNumberId,
            grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    // Check for duplicate
    const [existing] = await db.execute('SELECT id FROM tickets WHERE ticketNumber=?', [ticketNumber]);
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Ticket already exists', 
        ticketId: existing[0].id,
        message: 'This ticket number has already been captured. Supervisors can update it.' 
      });
    }

    // PCN Validations
    if (pcnNumber) {
      // 1. Check for mixing Sale Numbers or PS
      const [pcnCheck] = await db.execute(
        'SELECT saleNumberId, ps FROM tickets WHERE pcnNumber = ? LIMIT 1',
        [pcnNumber]
      );
      if (pcnCheck.length > 0) {
        if (pcnCheck[0].saleNumberId !== saleNumberId || pcnCheck[0].ps !== effectivePs) {
          return res.status(400).json({ 
            error: 'PCN Mixing Violation', 
            message: 'This PCN is already linked to a different Sale Number or Primary Society.' 
          });
        }
      }

      // 2. Check for max 25 tickets
      const [countCheck] = await db.execute(
        'SELECT COUNT(*) as count FROM tickets WHERE pcnNumber = ?',
        [pcnNumber]
      );
      if (countCheck[0].count >= 25) {
        return res.status(400).json({ 
          error: 'PCN Limit Reached', 
          message: 'A PCN cannot contain more than 25 tickets.' 
        });
      }
    }

    if (!supervisor) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id=?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to create ticket for this farmer' });
      }
    }

    await db.execute(`INSERT INTO tickets (id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId,
                       saleNumberId, grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId, saleNumberId,
       grossWeight, tareWeight || 0, netWeight, pricePerKg, totalValue, captureDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    // Sync PCN Record
    if (pcnNumber) {
      await syncPCNRecord(pcnNumber, saleNumberId, effectivePs);
    }

    res.json({ id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId, saleNumberId,
               grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps: effectivePs });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Error creating ticket' });
  }
});

app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update tickets' });
    const { farmerId, gradeId, marketCenterId, saleNumberId,
            grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber } = req.body;

    // PCN Validations for Update
    if (pcnNumber) {
      // 1. Check for mixing Sale Numbers or PS (excluding current ticket)
      const [pcnCheck] = await db.execute(
        'SELECT saleNumberId, ps FROM tickets WHERE pcnNumber = ? AND id != ? LIMIT 1',
        [pcnNumber, req.params.id]
      );
      if (pcnCheck.length > 0) {
        const psValue = isSupervisor(req.user) ? (req.body.ps || pcnCheck[0].ps) : req.user.ps;
        if (pcnCheck[0].saleNumberId !== saleNumberId || pcnCheck[0].ps !== psValue) {
          return res.status(400).json({ 
            error: 'PCN Mixing Violation', 
            message: 'This PCN is already linked to a different Sale Number or Primary Society.' 
          });
        }
      }

      // 2. Check for max 25 tickets
      const [countCheck] = await db.execute(
        'SELECT COUNT(*) as count FROM tickets WHERE pcnNumber = ? AND id != ?',
        [pcnNumber, req.params.id]
      );
      if (countCheck[0].count >= 25) {
        return res.status(400).json({ 
          error: 'PCN Limit Reached', 
          message: 'A PCN cannot contain more than 25 tickets.' 
        });
      }
    }

    // Get old PCN before update for re-sync
    const [oldTicket] = await db.execute('SELECT pcnNumber FROM tickets WHERE id = ?', [req.params.id]);
    const oldPcn = oldTicket.length > 0 ? oldTicket[0].pcnNumber : null;

    await db.execute(`UPDATE tickets SET farmerId=?, gradeId=?, marketCenterId=?, saleNumberId=?,
                       grossWeight=?, tareWeight=?, netWeight=?, pricePerKg=?, totalValue=?,
                       captureDate=?, pcnNumber=? WHERE id=?`,
      [farmerId, gradeId, marketCenterId, saleNumberId,
       grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber, req.params.id]);

    // Sync PCN Records (both old and new)
    if (pcnNumber) await syncPCNRecord(pcnNumber, saleNumberId, req.user.ps);
    if (oldPcn && oldPcn !== pcnNumber) await syncPCNRecord(oldPcn, null, req.user.ps);

    res.json({ id: req.params.id, message: 'Ticket updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating ticket' });
  }
});

app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    
    // Get PCN before deletion to re-sync
    const [ticket] = await db.execute('SELECT pcnNumber FROM tickets WHERE id = ?', [req.params.id]);
    const pcn = ticket.length > 0 ? ticket[0].pcnNumber : null;

    await db.execute('DELETE FROM tickets WHERE id=?', [req.params.id]);

    // Re-sync PCN
    if (pcn) await syncPCNRecord(pcn, null, req.user.ps);

    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting ticket' });
  }
});

// ─── PCNs ─────────────────────────────────────────────────────────────────────

app.get('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const query = supervisor
      ? 'SELECT * FROM pcns ORDER BY createdAt DESC'
      : "SELECT * FROM pcns WHERE ps = 'All' OR ps = ? ORDER BY createdAt DESC";
    const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const { pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pcnNumber, saleNumber, effectivePs, totalFarmers || 0, totalTickets || 0,
       totalWeight || 0, totalValue || 0, status || 'Open',
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, pcnNumber, saleNumber, ps: effectivePs, totalFarmers, totalTickets, totalWeight, totalValue, status: status || 'Open' });
  } catch (error) {
    console.error('Create PCN error:', error);
    res.status(500).json({ error: 'Error creating PCN' });
  }
});

app.put('/api/pcns/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update PCNs' });
    const { status, totalFarmers, totalTickets, totalWeight, totalValue } = req.body;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'Closed') {
        updates.push('closedAt = ?', 'closedBy = ?');
        params.push(now, req.user.username);
      }
      if (status === 'Approved') {
        updates.push('approvedAt = ?', 'approvedBy = ?');
        params.push(now, req.user.username);
      }
    }
    if (totalFarmers !== undefined) { updates.push('totalFarmers = ?'); params.push(totalFarmers); }
    if (totalTickets !== undefined) { updates.push('totalTickets = ?'); params.push(totalTickets); }
    if (totalWeight !== undefined) { updates.push('totalWeight = ?'); params.push(totalWeight); }
    if (totalValue !== undefined) { updates.push('totalValue = ?'); params.push(totalValue); }

    if (updates.length === 0) return res.json({ message: 'Nothing to update' });

    params.push(req.params.id);
    await db.execute(`UPDATE pcns SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.execute('SELECT * FROM pcns WHERE id=?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Update PCN error:', error);
    res.status(500).json({ error: 'Error updating PCN' });
  }
});

app.delete('/api/pcns/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM pcns WHERE id=?', [req.params.id]);
    res.json({ message: 'PCN deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting PCN' });
  }
});

// ─── EXCHANGE RATE ────────────────────────────────────────────────────────────

app.get('/api/exchange-rate', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT value FROM system_settings WHERE key='exchange_rate'");
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].value));
    } else {
      res.json({ rate: '', locked: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/exchange-rate', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can set exchange rate' });
    const { rate, locked } = req.body;
    const value = JSON.stringify({ rate, locked });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES ('exchange_rate', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [value, now]
    );
    res.json({ rate, locked });
  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({ error: 'Error saving exchange rate' });
  }
});

app.get('/api/exchange-rates', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT value FROM system_settings WHERE key='exchange_rates_by_ps'");
    if (rows.length > 0) {
      return res.json(JSON.parse(rows[0].value));
    }
    res.json({ byPs: {} });
  } catch (error) {
    console.error('Get exchange-rates error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/exchange-rates', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can set exchange rates' });
    const payload = {
      byPs: (req.body && typeof req.body.byPs === 'object') ? req.body.byPs : {}
    };
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES ('exchange_rates_by_ps', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [JSON.stringify(payload), now]
    );
    res.json(payload);
  } catch (error) {
    console.error('Save exchange-rates error:', error);
    res.status(500).json({ error: 'Error saving exchange rates' });
  }
});

app.get('/api/tzs-deductions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT value FROM system_settings WHERE key='tzs_deductions_by_ps'");
    if (rows.length > 0) {
      return res.json(JSON.parse(rows[0].value));
    }
    res.json({ byPs: {} });
  } catch (error) {
    console.error('Get tzs-deductions error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tzs-deductions', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can set deductions' });
    const payload = {
      byPs: (req.body && typeof req.body.byPs === 'object') ? req.body.byPs : {}
    };
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES ('tzs_deductions_by_ps', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [JSON.stringify(payload), now]
    );
    res.json(payload);
  } catch (error) {
    console.error('Save tzs-deductions error:', error);
    res.status(500).json({ error: 'Error saving deductions' });
  }
});

// ─── DEDUCTION RATES (PER PS) ───────────────────────────────────────────────

app.get('/api/deduction-rates', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT value FROM system_settings WHERE key='deduction_rates'");
    if (rows.length > 0) {
      const parsed = JSON.parse(rows[0].value);
      return res.json(parsed);
    }
    res.json({
      default: { levyRate: 2, adminFeeRate: 1 },
      byPs: {}
    });
  } catch (error) {
    console.error('Get deduction rates error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/deduction-rates', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can set deduction rates' });

    const payload = req.body || {};
    const safe = {
      default: {
        levyRate: Number(payload?.default?.levyRate ?? 2),
        adminFeeRate: Number(payload?.default?.adminFeeRate ?? 1)
      },
      byPs: {}
    };

    const sourceByPs = payload?.byPs && typeof payload.byPs === 'object' ? payload.byPs : {};
    for (const [psCode, rates] of Object.entries(sourceByPs)) {
      safe.byPs[psCode] = {
        levyRate: Number(rates?.levyRate ?? safe.default.levyRate),
        adminFeeRate: Number(rates?.adminFeeRate ?? safe.default.adminFeeRate)
      };
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES ('deduction_rates', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [JSON.stringify(safe), now]
    );

    res.json(safe);
  } catch (error) {
    console.error('Save deduction rates error:', error);
    res.status(500).json({ error: 'Error saving deduction rates' });
  }
});

// ─── PAYMENTS ────────────────────────────────────────────────────────────────

app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT p.*, f.farmerNumber, f.firstName, f.lastName, f.village, f.phoneNumber,
                               pcn.pcnNumber
                       FROM payments p
                       JOIN farmers f ON p.farmerId = f.id
                       LEFT JOIN pcns pcn ON p.pcnId = pcn.id`;
    const whereClause = supervisor ? '' : " WHERE p.ps = 'All' OR p.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY p.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
            exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps } = req.body;
    const id = uuidv4();
    const effectivePs = ps || req.user.ps;

    await db.execute(`INSERT INTO payments (id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
                       exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, pcnId || null, tobaccoAmount, inputDeduction, usdBalance || 0,
       exchangeRate || 0, tzsGross || 0, levy || 0, adminFee || 0, totalDeductions || 0,
       netPayment, paymentDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
               exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps: effectivePs });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Error creating payment' });
  }
});

app.delete('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM payments WHERE id=?', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting payment' });
  }
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

// Sales by Sale Number summary report
app.get('/api/reports/sales-by-sale', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const whereClause = supervisor ? '' : " WHERE t.ps = 'All' OR t.ps = ?";

    const [rows] = await db.execute(
      `SELECT sn.saleNumber, t.ps,
              COUNT(t.id) as totalBales,
              SUM(t.netWeight) as totalMass,
              SUM(t.totalValue) as totalValue,
              CASE WHEN SUM(t.netWeight) > 0 THEN SUM(t.totalValue) / SUM(t.netWeight) ELSE 0 END as avgPrice,
              mc.name as marketCenter
       FROM tickets t
       JOIN sale_numbers sn ON t.saleNumberId = sn.id
       JOIN market_centers mc ON t.marketCenterId = mc.id
       ${whereClause}
       GROUP BY sn.saleNumber, t.ps, mc.name
       ORDER BY sn.saleNumber`,
      supervisor ? [] : [psFilter]
    );
    res.json(rows);
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── SERVE FRONTEND (PRODUCTION) ────────────────────────────────────────────────
// Serve static frontend files from 'dist' outside the 'backend' folder
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  if (sqliteDb) {
    sqliteDb.close().then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});