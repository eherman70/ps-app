'use strict';
/**
 * routes/registration.js
 * Covers: primary societies, seasons, grades, market-centers, sale-numbers
 * All routes isolated — an error in grades won't affect seasons.
 */

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { isSupervisor } = require('../auth');

module.exports = function registrationRouter(getDb, auth) {
  const router = Router();

  // ─── PRIMARY SOCIETIES ────────────────────────────────────────────────────
  router.get('/ps', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute('SELECT * FROM primary_societies ORDER BY name');
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/ps', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, code, status } = req.body;
      const id = uuidv4();
      await getDb().execute(
        'INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, name, code, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, name, code, status: status || 'Active' });
    } catch (err) { res.status(500).json({ error: 'Error creating society' }); }
  });

  router.put('/ps/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, code, status } = req.body;
      await getDb().execute('UPDATE primary_societies SET name=?, code=?, status=? WHERE id=?',
        [name, code, status, req.params.id]);
      res.json({ id: req.params.id, name, code, status });
    } catch (err) { res.status(500).json({ error: 'Error updating society' }); }
  });

  router.delete('/ps/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      await getDb().execute('DELETE FROM primary_societies WHERE id=?', [req.params.id]);
      res.json({ message: 'Society deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting society' }); }
  });

  // ─── SEASONS ──────────────────────────────────────────────────────────────
  router.get('/seasons', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute('SELECT * FROM seasons ORDER BY createdAt DESC');
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/seasons', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, startDate, endDate } = req.body;
      // Enforce single active season
      const [active] = await getDb().execute("SELECT id, name FROM seasons WHERE status = 'Active' LIMIT 1");
      if (active.length) {
        return res.status(409).json({
          error: `Season "${active[0].name}" is still active. Please close it before creating a new season.`
        });
      }
      const id = uuidv4();
      await getDb().execute(
        'INSERT INTO seasons (id, name, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, startDate, endDate, 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, name, startDate, endDate, status: 'Active' });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      res.status(500).json({ error: 'Error creating season' });
    }
  });

  router.put('/seasons/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, startDate, endDate, status } = req.body;
      // If re-activating, ensure no other season is active
      if (status === 'Active') {
        const [active] = await getDb().execute(
          "SELECT id, name FROM seasons WHERE status = 'Active' AND id != ? LIMIT 1",
          [req.params.id]
        );
        if (active.length) {
          return res.status(409).json({
            error: `Season "${active[0].name}" is still active. Please close it first.`
          });
        }
      }
      await getDb().execute('UPDATE seasons SET name=?, startDate=?, endDate=?, status=? WHERE id=?',
        [name, startDate, endDate, status, req.params.id]);
      res.json({ id: req.params.id, name, startDate, endDate, status });
    } catch (err) { res.status(500).json({ error: 'Error updating season' }); }
  });

  // ─── CLOSE SEASON (with debt carryover) ──────────────────────────────────
  router.post('/seasons/:id/close', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });

      const db = getDb();
      const [seasonRows] = await db.execute('SELECT * FROM seasons WHERE id = ?', [req.params.id]);
      if (!seasonRows.length) return res.status(404).json({ error: 'Season not found' });
      const season = seasonRows[0];
      if (season.status === 'Closed') return res.status(400).json({ error: 'Season is already closed' });

      // Get or create the system "Debt Carryover" input type
      let [ctRows] = await db.execute("SELECT id FROM input_types WHERE name = '__DEBT_CARRYOVER__' LIMIT 1");
      let carryoverTypeId;
      if (ctRows.length) {
        carryoverTypeId = ctRows[0].id;
      } else {
        carryoverTypeId = uuidv4();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO input_types (id, name, category, unitPrice, unit, status, createdAt)
           VALUES (?, '__DEBT_CARRYOVER__', 'Debt Carryover', 1, 'Fixed', 'Active', ?)`,
          [carryoverTypeId, now]
        );
      }

      // Compute net debt per farmer: total issued inputs cost minus total payment input deductions
      const [issuedRows] = await db.execute(
        `SELECT farmerId, SUM(totalCost) as totalIssued
         FROM issued_inputs
         WHERE description NOT LIKE '[SETTLED]%'
         GROUP BY farmerId`
      );
      const [paidRows] = await db.execute(
        `SELECT farmerId, SUM(inputDeduction) as totalPaid FROM payments GROUP BY farmerId`
      );

      const issuedMap = {};
      for (const r of issuedRows) issuedMap[r.farmerId] = parseFloat(r.totalIssued || 0);
      const paidMap = {};
      for (const r of paidRows) paidMap[r.farmerId] = parseFloat(r.totalPaid || 0);

      // All farmers who have any issued inputs
      const farmerIds = [...new Set([...Object.keys(issuedMap)])];
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const today = new Date().toISOString().slice(0, 10);

      const carryovers = [];

      await db.transaction(async (tx) => {
        // Mark season as closed
        await tx.execute("UPDATE seasons SET status = 'Closed' WHERE id = ?", [req.params.id]);

        for (const farmerId of farmerIds) {
          const issued = issuedMap[farmerId] || 0;
          const paid   = paidMap[farmerId]   || 0;
          const netDebt = Math.round((issued - paid) * 100) / 100;

          if (netDebt <= 0) continue; // fully settled, nothing to carry over

          // Fetch farmer details for ps
          const [fRows] = await tx.execute('SELECT ps, farmerNumber, firstName, lastName FROM farmers WHERE id = ?', [farmerId]);
          if (!fRows.length) continue;
          const farmer = fRows[0];

          // Mark all existing active issued_inputs for this farmer as [SETTLED]
          await tx.execute(
            `UPDATE issued_inputs SET description = '[SETTLED] ' || COALESCE(description, '')
             WHERE farmerId = ? AND (description IS NULL OR description NOT LIKE '[SETTLED]%')`,
            [farmerId]
          );

          // Create a single carryover record for the outstanding balance
          const carryoverId = uuidv4();
          await tx.execute(
            `INSERT INTO issued_inputs
               (id, farmerId, inputTypeId, quantity, totalCost, description, issueDate, ps, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [carryoverId, farmerId, carryoverTypeId, 1, netDebt,
             `Carried over from season: ${season.name || season.id}`,
             today, farmer.ps, now]
          );

          carryovers.push({
            farmerId,
            farmerNumber: farmer.farmerNumber,
            farmerName: `${farmer.firstName} ${farmer.lastName}`,
            netDebt
          });
        }
      });

      res.json({
        message: `Season "${season.name}" closed successfully.`,
        carryoverCount: carryovers.length,
        carryovers
      });
    } catch (err) {
      console.error('[Seasons] Close error:', err.message);
      res.status(500).json({ error: 'Error closing season: ' + err.message });
    }
  });

  router.delete('/seasons/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      // Prevent deletion of the active season
      const [rows] = await getDb().execute("SELECT status FROM seasons WHERE id = ?", [req.params.id]);
      if (rows.length && rows[0].status === 'Active') {
        return res.status(400).json({ error: 'Cannot delete an active season. Close it first.' });
      }
      await getDb().execute('DELETE FROM seasons WHERE id=?', [req.params.id]);
      res.json({ message: 'Season deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting season' }); }
  });

  // ─── GRADES ───────────────────────────────────────────────────────────────
  router.get('/grades', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute('SELECT * FROM grades ORDER BY name');
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/grades', auth, async (req, res) => {
    try {
      const { name, price, description, status, grade_code, group_name, category,
              quality_level, grade_class, is_quality_grade } = req.body;
      const id = uuidv4();
      await getDb().execute(
        `INSERT INTO grades (id, name, price, description, status, grade_code, group_name, category,
           quality_level, grade_class, is_quality_grade, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, price, description, status || 'Active', grade_code, group_name, category,
         quality_level, grade_class, is_quality_grade ?? 1,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, name, price, description, status: status || 'Active', grade_code, group_name,
                 category, quality_level, grade_class, is_quality_grade: is_quality_grade ?? 1 });
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed: grades.grade_code'))
        return res.status(409).json({ error: 'Grade code already exists' });
      console.error('[Registration] POST grade error:', err.message);
      res.status(500).json({ error: 'Error creating grade' });
    }
  });

  router.put('/grades/:id', auth, async (req, res) => {
    try {
      const { name, price, description, status, grade_code, group_name, category,
              quality_level, grade_class, is_quality_grade } = req.body;
      await getDb().execute(
        `UPDATE grades SET name=?, price=?, description=?, status=?, grade_code=?,
           group_name=?, category=?, quality_level=?, grade_class=?, is_quality_grade=? WHERE id=?`,
        [name, price, description, status, grade_code, group_name, category,
         quality_level, grade_class, is_quality_grade ?? 1, req.params.id]
      );
      res.json({ id: req.params.id, name, price, description, status, grade_code, group_name,
                 category, quality_level, grade_class, is_quality_grade: is_quality_grade ?? 1 });
    } catch (err) { res.status(500).json({ error: 'Error updating grade' }); }
  });

  router.delete('/grades/:id', auth, async (req, res) => {
    try {
      await getDb().execute('DELETE FROM grades WHERE id=?', [req.params.id]);
      res.json({ message: 'Grade deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting grade' }); }
  });

  // ─── MARKET CENTERS ───────────────────────────────────────────────────────
  router.get('/market-centers', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute('SELECT * FROM market_centers ORDER BY name');
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/market-centers', auth, async (req, res) => {
    try {
      const { name, location, status } = req.body;
      const id = uuidv4();
      await getDb().execute(
        'INSERT INTO market_centers (id, name, location, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, name, location, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, name, location, status });
    } catch (err) { res.status(500).json({ error: 'Error creating market center' }); }
  });

  router.put('/market-centers/:id', auth, async (req, res) => {
    try {
      const { name, location, status } = req.body;
      await getDb().execute('UPDATE market_centers SET name=?, location=?, status=? WHERE id=?',
        [name, location, status, req.params.id]);
      res.json({ id: req.params.id, name, location, status });
    } catch (err) { res.status(500).json({ error: 'Error updating market center' }); }
  });

  router.delete('/market-centers/:id', auth, async (req, res) => {
    try {
      await getDb().execute('DELETE FROM market_centers WHERE id=?', [req.params.id]);
      res.json({ message: 'Market center deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting market center' }); }
  });

  // ─── SALE NUMBERS ─────────────────────────────────────────────────────────
  router.get('/sale-numbers', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute(
        `SELECT sn.*, mc.name as marketCenterName, s.name as seasonName
         FROM sale_numbers sn
         JOIN market_centers mc ON sn.marketCenterId = mc.id
         JOIN seasons s ON sn.seasonId = s.id
         ORDER BY sn.createdAt DESC`
      );
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/sale-numbers', auth, async (req, res) => {
    try {
      const { saleNumber, marketCenterId, seasonId, status, ps } = req.body;
      const id = uuidv4();
      const finalPs = ps || 'All';
      await getDb().execute(
        'INSERT INTO sale_numbers (id, saleNumber, marketCenterId, seasonId, status, ps, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, saleNumber, marketCenterId, seasonId, status || 'Active', finalPs,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, saleNumber, marketCenterId, seasonId, status: status || 'Active', ps: finalPs });
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed'))
        return res.status(409).json({ error: 'This sale number already exists for the selected market center and season' });
      res.status(500).json({ error: 'Error creating sale number' });
    }
  });

  router.put('/sale-numbers/:id', auth, async (req, res) => {
    try {
      const { saleNumber, marketCenterId, seasonId, status, ps } = req.body;
      const finalPs = ps || 'All';
      await getDb().execute(
        'UPDATE sale_numbers SET saleNumber=?, marketCenterId=?, seasonId=?, status=?, ps=? WHERE id=?',
        [saleNumber, marketCenterId, seasonId, status, finalPs, req.params.id]
      );
      res.json({ id: req.params.id, saleNumber, marketCenterId, seasonId, status, ps: finalPs });
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed'))
        return res.status(409).json({ error: 'This sale number already exists for the selected market center and season' });
      res.status(500).json({ error: 'Error updating sale number' });
    }
  });

  router.delete('/sale-numbers/:id', auth, async (req, res) => {
    try {
      await getDb().execute('DELETE FROM sale_numbers WHERE id=?', [req.params.id]);
      res.json({ message: 'Sale number deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting sale number' }); }
  });

  // ─── INPUT TYPES ──────────────────────────────────────────────────────────
  router.get('/input-types', auth, async (req, res) => {
    try {
      const [rows] = await getDb().execute('SELECT * FROM input_types ORDER BY name');
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/input-types', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, category, unitPrice, unit, status } = req.body;
      const id = uuidv4();
      await getDb().execute(
        'INSERT INTO input_types (id, name, category, unitPrice, unit, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, name, category, unitPrice, unit, status,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, name, category, unitPrice, unit, status });
    } catch (err) { res.status(500).json({ error: 'Error creating input type' }); }
  });

  router.put('/input-types/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { name, category, unitPrice, unit, status } = req.body;
      await getDb().execute('UPDATE input_types SET name=?, category=?, unitPrice=?, unit=?, status=? WHERE id=?',
        [name, category, unitPrice, unit, status, req.params.id]);
      res.json({ id: req.params.id, name, category, unitPrice, unit, status });
    } catch (err) { res.status(500).json({ error: 'Error updating input type' }); }
  });

  router.delete('/input-types/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      await getDb().execute('DELETE FROM input_types WHERE id=?', [req.params.id]);
      res.json({ message: 'Input type deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting input type' }); }
  });

  // ─── ISSUED INPUTS ────────────────────────────────────────────────────────
  router.get('/issued-inputs', auth, async (req, res) => {
    try {
      const db = getDb();
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
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/issued-inputs', auth, async (req, res) => {
    try {
      const db = getDb();
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
      await db.execute(
        'INSERT INTO issued_inputs (id, farmerId, inputTypeId, quantity, totalCost, description, issueDate, ps, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, farmerId, inputTypeId, quantity, totalCost, description || null, issueDate, effectivePs,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps: effectivePs });
    } catch (err) { res.status(500).json({ error: 'Error issuing input' }); }
  });

  router.delete('/issued-inputs/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      await getDb().execute('DELETE FROM issued_inputs WHERE id=?', [req.params.id]);
      res.json({ message: 'Input deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting issued input' }); }
  });

  return router;
};
