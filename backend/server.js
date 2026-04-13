'use strict';
/**
 * server.js — Thin orchestrator
 *
 * Responsibilities:
 *  1. Bootstrap the database
 *  2. Register shared middleware
 *  3. Mount domain route modules (each is fully isolated)
 *  4. Seed initial data
 *  5. Serve the React frontend
 *
 * ALL business logic lives in:
 *   backend/db.js          – database adapter + schema + indexes
 *   backend/auth.js        – JWT middleware + role helpers + rate limiter
 *   backend/routes/*.js    – one file per domain
 */

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { initializeDatabase, closeDatabase, getDb } = require('./db');
const { makeAuthMiddleware } = require('./auth');

// Domain route modules
const usersRouter        = require('./routes/users');
const farmersRouter      = require('./routes/farmers');
const ticketsRouter      = require('./routes/tickets');
const pcnsRouter         = require('./routes/pcns');
const paymentsRouter     = require('./routes/payments');
const registrationRouter = require('./routes/registration');
const settingsRouter     = require('./routes/settings');
const reportsRouter      = require('./routes/reports');

// ── Global error guards ────────────────────────────────────────────────────
process.on('uncaughtException',  (err) => console.error('[UNCAUGHT]',   err.stack || err));
process.on('unhandledRejection', (r)   => console.error('[UNHANDLED]',  r));

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Bootstrap ──────────────────────────────────────────────────────────────
(async () => {
  try {
    await initializeDatabase();
    await seedDefaults();

    // Build auth middleware (needs getDb to be ready)
    const auth = makeAuthMiddleware(getDb);

    // ── Mount domain routers ──────────────────────────────────────────────
    // Users + Auth at two separate prefixes for backward compat
    const usersModule = usersRouter(getDb, auth);
    app.use('/api/auth', usersModule);   // /api/auth/login, /api/auth/register, /api/auth/me
    app.use('/api/users', usersModule);  // /api/users CRUD

    app.use('/api/farmers',      farmersRouter(getDb, auth));
    app.use('/api/tickets',      ticketsRouter(getDb, auth));
    app.use('/api/pcns',         pcnsRouter(getDb, auth));
    app.use('/api/payments',     paymentsRouter(getDb, auth));
    app.use('/api/reports',      reportsRouter(getDb, auth));

    // Registration umbrella (societies, seasons, grades, market-centers, sale-numbers, input-types, issued-inputs)
    const regRouter = registrationRouter(getDb, auth);
    app.use('/api', regRouter);           // all routes already include their prefix (e.g. /grades)

    // Settings
    app.use('/api', settingsRouter(getDb, auth));

    // ── Health check ──────────────────────────────────────────────────────
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        modules: ['farmers', 'tickets', 'pcns', 'payments', 'reports',
                  'registration', 'settings', 'users'],
      });
    });

    // ── Serve frontend ────────────────────────────────────────────────────
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../dist', 'index.html')));

    app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));

  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
})();

// ── Seed defaults ──────────────────────────────────────────────────────────
async function seedDefaults() {
  const db = getDb();
  await seedPrimarySocieties(db);
  await seedAdmin(db);
  await syncGrades(db);
  await repairTickets(db);
  await syncPCNsFromTickets(db);
}

async function seedPrimarySocieties(db) {
  try {
    const [rows] = await db.execute('SELECT id FROM primary_societies LIMIT 1');
    if (rows.length) return;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const ps of [
      { id: uuidv4(), name: 'Default Society', code: 'DEFAULT', status: 'Active' },
      { id: uuidv4(), name: 'Society A',        code: 'A',       status: 'Active' },
      { id: uuidv4(), name: 'Society B',        code: 'B',       status: 'Active' },
    ]) {
      await db.execute('INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [ps.id, ps.name, ps.code, ps.status, now]);
    }
    console.log('[Seed] Default primary societies created.');
  } catch (e) { console.error('[Seed] PS error:', e.message); }
}

async function seedAdmin(db) {
  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (rows.length) return;
    await db.execute(
      'INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), 'admin', bcrypt.hashSync('admin123', 10), 'System Administrator',
       'Supervisor', 'All', 0, 0, new Date().toISOString().slice(0, 19).replace('T', ' ')]
    );
    console.log('[Seed] Default admin user created.');
  } catch (e) { console.error('[Seed] Admin error:', e.message); }
}

async function repairTickets(db) {
  try {
    const [rows] = await db.execute("SELECT COUNT(*) as count FROM tickets WHERE saleNumberId = '' OR saleNumberId IS NULL");
    if (rows[0].count > 0) {
      console.log(`[Repair] Fixing ${rows[0].count} tickets with missing saleNumberId…`);
      await db.execute(`
        UPDATE tickets SET saleNumberId = (
          SELECT t2.saleNumberId FROM tickets t2
          WHERE t2.pcnNumber = tickets.pcnNumber AND t2.saleNumberId != '' AND t2.saleNumberId IS NOT NULL
          LIMIT 1
        )
        WHERE (saleNumberId = '' OR saleNumberId IS NULL) AND pcnNumber IS NOT NULL
        AND EXISTS (SELECT 1 FROM tickets t2 WHERE t2.pcnNumber = tickets.pcnNumber AND t2.saleNumberId != '' AND t2.saleNumberId IS NOT NULL)
      `);
      console.log('[Repair] Done.');
    }
  } catch (e) { console.warn('[Repair] Warning:', e.message); }
}

async function syncPCNsFromTickets(db) {
  try {
    const [rows] = await db.execute("SELECT DISTINCT pcnNumber, saleNumberId, ps FROM tickets WHERE pcnNumber IS NOT NULL AND pcnNumber != ''");
    if (!rows.length) return;
    console.log(`[Seed] Syncing ${rows.length} PCNs from tickets…`);
    const { v4: uuid } = require('uuid');
    for (const row of rows) {
      // minimal sync: ensure PCN row exists
      const [existing] = await db.execute('SELECT id FROM pcns WHERE pcnNumber = ?', [row.pcnNumber]);
      if (!existing.length) {
        const [totals] = await db.execute(
          'SELECT COUNT(*) as tc, SUM(netWeight) as tw, SUM(totalValue) as tv, COUNT(DISTINCT farmerId) as tf FROM tickets WHERE pcnNumber = ?',
          [row.pcnNumber]
        );
        const t = totals[0];
        const [snRows] = row.saleNumberId
          ? await db.execute('SELECT saleNumber FROM sale_numbers WHERE id = ?', [row.saleNumberId])
          : [[]];
        await db.execute(
          `INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)`,
          [uuid(), row.pcnNumber, snRows[0]?.saleNumber || 'TBD', row.ps || 'All',
           t.tf || 0, t.tc || 0, t.tw || 0, t.tv || 0,
           new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
      }
    }
    console.log('[Seed] PCN sync complete.');
  } catch (e) { console.warn('[Seed] PCN sync warning:', e.message); }
}

// Grade master list sync
async function syncGrades(db) {
  const MASTER = [
    { c:'X1L',g:'LUGS_LEMON',cat:'LUGS',q:'Choice',p:2.370,cls:'STANDARD',q_:1},{ c:'X2L',g:'LUGS_LEMON',cat:'LUGS',q:'Fine',p:2.112,cls:'STANDARD',q_:1},
    { c:'X3L',g:'LUGS_LEMON',cat:'LUGS',q:'Good',p:1.474,cls:'STANDARD',q_:1},{ c:'X4L',g:'LUGS_LEMON',cat:'LUGS',q:'Fair',p:0.891,cls:'STANDARD',q_:1},
    { c:'X5L',g:'LUGS_LEMON',cat:'LUGS',q:'Low',p:0.555,cls:'STANDARD',q_:1},{ c:'X1O',g:'LUGS_ORANGE',cat:'LUGS',q:'Choice',p:2.405,cls:'STANDARD',q_:1},
    { c:'X2O',g:'LUGS_ORANGE',cat:'LUGS',q:'Fine',p:2.225,cls:'STANDARD',q_:1},{ c:'X3O',g:'LUGS_ORANGE',cat:'LUGS',q:'Good',p:1.588,cls:'STANDARD',q_:1},
    { c:'X4O',g:'LUGS_ORANGE',cat:'LUGS',q:'Fair',p:0.939,cls:'STANDARD',q_:1},{ c:'X5O',g:'LUGS_ORANGE',cat:'LUGS',q:'Low',p:0.590,cls:'STANDARD',q_:1},
    { c:'X6O',g:'LUGS_ORANGE',cat:'LUGS',q:'Reject',p:0.250,cls:'REJECT',q_:1},{ c:'XLV',g:'LUGS_VAR',cat:'LUGS',q:'Low',p:0.579,cls:'STANDARD',q_:1},
    { c:'XOV',g:'LUGS_VAR',cat:'LUGS',q:'Low',p:0.634,cls:'STANDARD',q_:1},{ c:'XND',g:'NON_DESCRIPT',cat:'LUGS',q:'Reject',p:0.164,cls:'REJECT',q_:1},
    { c:'XG',g:'LUGS_REJECT',cat:'LUGS',q:'Reject',p:0.391,cls:'REJECT',q_:1},{ c:'C1L',g:'CUTTERS_LEMON',cat:'CUTTERS',q:'Choice',p:2.632,cls:'STANDARD',q_:1},
    { c:'C2L',g:'CUTTERS_LEMON',cat:'CUTTERS',q:'Fine',p:2.383,cls:'STANDARD',q_:1},{ c:'C3L',g:'CUTTERS_LEMON',cat:'CUTTERS',q:'Good',p:1.795,cls:'STANDARD',q_:1},
    { c:'C4L',g:'CUTTERS_LEMON',cat:'CUTTERS',q:'Fair',p:1.262,cls:'STANDARD',q_:1},{ c:'C5L',g:'CUTTERS_LEMON',cat:'CUTTERS',q:'Low',p:0.604,cls:'STANDARD',q_:1},
    { c:'C1O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Choice',p:2.753,cls:'STANDARD',q_:1},{ c:'C2O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Fine',p:2.556,cls:'STANDARD',q_:1},
    { c:'C3O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Good',p:1.870,cls:'STANDARD',q_:1},{ c:'C4O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Fair',p:1.368,cls:'STANDARD',q_:1},
    { c:'C5O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Low',p:0.654,cls:'STANDARD',q_:1},{ c:'C6O',g:'CUTTERS_ORANGE',cat:'CUTTERS',q:'Reject',p:0.469,cls:'REJECT',q_:1},
    { c:'L1L',g:'LEAF_LEMON',cat:'LEAF',q:'Choice',p:3.185,cls:'STANDARD',q_:1},{ c:'L2L',g:'LEAF_LEMON',cat:'LEAF',q:'Fine',p:2.843,cls:'STANDARD',q_:1},
    { c:'L3L',g:'LEAF_LEMON',cat:'LEAF',q:'Good',p:2.246,cls:'STANDARD',q_:1},{ c:'L4L',g:'LEAF_LEMON',cat:'LEAF',q:'Fair',p:1.748,cls:'STANDARD',q_:1},
    { c:'L5L',g:'LEAF_LEMON',cat:'LEAF',q:'Low',p:1.240,cls:'STANDARD',q_:1},{ c:'L1O',g:'LEAF_ORANGE',cat:'LEAF',q:'Choice',p:3.268,cls:'STANDARD',q_:1},
    { c:'L2O',g:'LEAF_ORANGE',cat:'LEAF',q:'Fine',p:3.130,cls:'STANDARD',q_:1},{ c:'L3O',g:'LEAF_ORANGE',cat:'LEAF',q:'Good',p:2.688,cls:'STANDARD',q_:1},
    { c:'L4O',g:'LEAF_ORANGE',cat:'LEAF',q:'Fair',p:1.900,cls:'STANDARD',q_:1},{ c:'L5O',g:'LEAF_ORANGE',cat:'LEAF',q:'Low',p:1.378,cls:'STANDARD',q_:1},
    { c:'L1R',g:'LEAF_RED',cat:'LEAF',q:'Choice',p:3.176,cls:'STANDARD',q_:1},{ c:'L2R',g:'LEAF_RED',cat:'LEAF',q:'Fine',p:2.763,cls:'STANDARD',q_:1},
    { c:'L3R',g:'LEAF_RED',cat:'LEAF',q:'Good',p:2.012,cls:'STANDARD',q_:1},{ c:'L4R',g:'LEAF_RED',cat:'LEAF',q:'Fair',p:1.441,cls:'STANDARD',q_:1},
    { c:'L5R',g:'LEAF_RED',cat:'LEAF',q:'Low',p:1.072,cls:'STANDARD',q_:1},{ c:'LLV',g:'LEAF_VAR',cat:'LEAF',q:'Low',p:0.950,cls:'STANDARD',q_:1},
    { c:'LOV',g:'LEAF_VAR',cat:'LEAF',q:'Low',p:1.094,cls:'STANDARD',q_:1},{ c:'LND',g:'NON_DESCRIPT',cat:'LEAF',q:'Reject',p:0.261,cls:'REJECT',q_:1},
    { c:'LG',g:'LEAF_REJECT',cat:'LEAF',q:'Reject',p:0.391,cls:'REJECT',q_:1},{ c:'B1L',g:'BRIGHT_LEAF',cat:'LEAF',q:'Choice',p:0.519,cls:'SPECIAL',q_:1},
    { c:'B1O',g:'BRIGHT_LEAF',cat:'LEAF',q:'Choice',p:0.571,cls:'SPECIAL',q_:1},{ c:'LK',g:'LEAF_VAR',cat:'LEAF',q:'Low',p:0.589,cls:'SPECIAL',q_:1},
    { c:'M1L',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Choice',p:3.010,cls:'STANDARD',q_:1},{ c:'M2L',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fine',p:2.600,cls:'STANDARD',q_:1},
    { c:'M3L',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Good',p:1.973,cls:'STANDARD',q_:1},{ c:'M4L',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fair',p:1.385,cls:'STANDARD',q_:1},
    { c:'M5L',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Low',p:1.058,cls:'STANDARD',q_:1},{ c:'M1O',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Choice',p:3.163,cls:'STANDARD',q_:1},
    { c:'M2O',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fine',p:2.917,cls:'STANDARD',q_:1},{ c:'M3O',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Good',p:2.324,cls:'STANDARD',q_:1},
    { c:'M4O',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fair',p:1.731,cls:'STANDARD',q_:1},{ c:'M5O',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Low',p:1.229,cls:'STANDARD',q_:1},
    { c:'M1R',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Choice',p:2.841,cls:'STANDARD',q_:1},{ c:'M2R',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fine',p:2.720,cls:'STANDARD',q_:1},
    { c:'M3R',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Good',p:1.895,cls:'STANDARD',q_:1},{ c:'M4R',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Fair',p:1.396,cls:'STANDARD',q_:1},
    { c:'M5R',g:'SMOKING_LEAF',cat:'SMOKING_LEAF',q:'Low',p:0.969,cls:'STANDARD',q_:1},{ c:'L1OF',g:'LEAF_ORANGE_FULL',cat:'LEAF',q:'Choice',p:3.320,cls:'PREMIUM',q_:1},
    { c:'L2OF',g:'LEAF_ORANGE_FULL',cat:'LEAF',q:'Fine',p:3.240,cls:'PREMIUM',q_:1},{ c:'L3OF',g:'LEAF_ORANGE_FULL',cat:'LEAF',q:'Good',p:2.860,cls:'PREMIUM',q_:1},
    { c:'REJ',g:'REJECT',cat:'REJECT',q:'Reject',p:0,cls:'REJECT',q_:1},{ c:'CAN',g:'PROCESS',cat:'PROCESS',q:'None',p:0,cls:'PROCESS',q_:0},
    { c:'WIT',g:'PROCESS',cat:'PROCESS',q:'None',p:0,cls:'PROCESS',q_:0},
  ];
  try {
    for (const g of MASTER) {
      const [ex] = await db.execute('SELECT id FROM grades WHERE grade_code = ?', [g.c]);
      if (ex.length) {
        await db.execute('UPDATE grades SET price=? WHERE grade_code=?', [g.p, g.c]);
      } else {
        await db.execute(
          `INSERT INTO grades (id, name, price, description, status, grade_code, group_name, category, quality_level, grade_class, is_quality_grade, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), g.c, g.p, `Master Grade ${g.c}`, 'Active', g.c, g.g, g.cat, g.q, g.cls, g.q_,
           new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
      }
    }
    console.log('[Seed] Grades synced.');
  } catch (e) { console.error('[Seed] Grade sync error:', e.message); }
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('[Server] Shutting down gracefully…');
  await closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});