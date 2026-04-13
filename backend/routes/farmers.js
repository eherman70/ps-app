'use strict';
/**
 * routes/farmers.js — Farmer CRUD with pagination + search
 */

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { isSupervisor, canAccessPs } = require('../auth');

module.exports = function farmersRouter(getDb, auth) {
  const router = Router();

  // ── LIST (paginated) ──────────────────────────────────────────────────────
  router.get('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const supervisor = isSupervisor(req.user);
      const psFilter = req.user.ps || 'All';

      // Pagination
      const limit = Math.min(parseInt(req.query.limit) || 200, 500);
      const page  = Math.max(parseInt(req.query.page)  || 1, 1);
      const offset = (page - 1) * limit;

      // Optional filters
      const search = (req.query.search || '').trim();
      const psParam = req.query.ps || '';

      let whereParts = [];
      let params = [];

      if (!supervisor) {
        whereParts.push("(f.ps = 'All' OR f.ps = ?)");
        params.push(psFilter);
      } else if (psParam) {
        whereParts.push("f.ps = ?");
        params.push(psParam);
      }

      if (search) {
        whereParts.push("(f.firstName ILIKE ? OR f.lastName ILIKE ? OR f.farmerNumber ILIKE ?)");
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const whereClause = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

      // Total count
      const [countRows] = await db.execute(
        `SELECT COUNT(*) as total FROM farmers f ${whereClause}`,
        params
      );
      const total = parseInt(countRows[0]?.total || countRows[0]?.count || 0);

      // Data page
      const [rows] = await db.execute(
        `SELECT f.*, s.name as seasonName
         FROM farmers f
         LEFT JOIN seasons s ON f.seasonId = s.id
         ${whereClause}
         ORDER BY f.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({ data: rows, total, page, pages: Math.ceil(total / limit), limit });
    } catch (err) {
      console.error('[Farmers] GET error:', err.message);
      res.status(500).json({ error: 'Failed to load farmers' });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────
  router.post('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const { farmerNumber, firstName, middleName, lastName, gender, age, village,
              phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
      const id = uuidv4();
      const supervisor = isSupervisor(req.user);
      const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

      await db.execute(
        `INSERT INTO farmers (id, farmerNumber, firstName, middleName, lastName, gender, age,
           village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, ps, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, farmerNumber, firstName, middleName, lastName, gender, age, village,
         phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
         effectivePs, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, farmerNumber, firstName, middleName, lastName, gender, age, village,
                 phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
                 status: status || 'Active', ps: effectivePs });
    } catch (err) {
      if (err.code === '23505' || (err.message && err.message.includes('UNIQUE') && err.message.includes('farmerNumber'))) {
        return res.status(409).json({ error: `Farmer number '${req.body.farmerNumber}' already exists.` });
      }
      console.error('[Farmers] POST error:', err.message);
      res.status(500).json({ error: 'Error creating farmer' });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  router.put('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      const { farmerNumber, firstName, middleName, lastName, gender, age, village,
              phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
      const supervisor = isSupervisor(req.user);
      const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

      const [existing] = await db.execute('SELECT ps FROM farmers WHERE id = ?', [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Farmer not found' });
      if (!canAccessPs(req.user, existing[0].ps)) return res.status(403).json({ error: 'Access denied' });

      await db.execute(
        `UPDATE farmers SET farmerNumber=?, firstName=?, middleName=?, lastName=?, gender=?, age=?,
           village=?, phoneNumber=?, idType=?, idNumber=?, hectares=?, contractedVolume=?,
           seasonId=?, ps=?, status=? WHERE id=?`,
        [farmerNumber, firstName, middleName, lastName, gender, age, village,
         phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
         effectivePs, status || 'Active', req.params.id]
      );
      res.json({ id: req.params.id, farmerNumber, firstName, middleName, lastName, gender, age,
                 village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
                 status, ps: effectivePs });
    } catch (err) {
      console.error('[Farmers] PUT error:', err.message);
      res.status(500).json({ error: 'Error updating farmer' });
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  router.delete('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      const [rows] = await db.execute('SELECT ps FROM farmers WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Farmer not found' });
      if (!isSupervisor(req.user) && !canAccessPs(req.user, rows[0].ps)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await db.execute('DELETE FROM farmers WHERE id = ?', [req.params.id]);
      res.json({ message: 'Farmer deleted' });
    } catch (err) {
      console.error('[Farmers] DELETE error:', err.message);
      res.status(500).json({ error: 'Error deleting farmer' });
    }
  });

  return router;
};
