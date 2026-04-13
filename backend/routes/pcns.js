'use strict';
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { isSupervisor } = require('../auth');

module.exports = function pcnsRouter(getDb, auth) {
  const router = Router();

  router.get('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const supervisor = isSupervisor(req.user);
      const psFilter = req.user.ps || 'All';
      const query = supervisor
        ? 'SELECT * FROM pcns ORDER BY createdAt DESC'
        : "SELECT * FROM pcns WHERE ps = 'All' OR ps = ? ORDER BY createdAt DESC";
      const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
      res.json(rows);
    } catch (err) {
      console.error('[PCNs] GET error:', err.message);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.post('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const { pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status } = req.body;
      const id = uuidv4();
      const effectivePs = isSupervisor(req.user) ? (ps || 'All') : req.user.ps;
      await db.execute(
        `INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, pcnNumber, saleNumber, effectivePs, totalFarmers || 0, totalTickets || 0,
         totalWeight || 0, totalValue || 0, status || 'Open',
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, pcnNumber, saleNumber, ps: effectivePs, totalFarmers, totalTickets, totalWeight, totalValue, status: status || 'Open' });
    } catch (err) {
      console.error('[PCNs] POST error:', err.message);
      res.status(500).json({ error: 'Error creating PCN' });
    }
  });

  router.put('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update PCNs' });
      const { status, totalFarmers, totalTickets, totalWeight, totalValue } = req.body;
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const updates = []; const params = [];
      if (status !== undefined) {
        updates.push('status = ?'); params.push(status);
        if (status === 'Closed')   { updates.push('closedAt = ?', 'closedBy = ?');   params.push(now, req.user.username); }
        if (status === 'Approved') { updates.push('approvedAt = ?', 'approvedBy = ?'); params.push(now, req.user.username); }
      }
      if (totalFarmers !== undefined) { updates.push('totalFarmers = ?'); params.push(totalFarmers); }
      if (totalTickets !== undefined) { updates.push('totalTickets = ?'); params.push(totalTickets); }
      if (totalWeight  !== undefined) { updates.push('totalWeight = ?');  params.push(totalWeight); }
      if (totalValue   !== undefined) { updates.push('totalValue = ?');   params.push(totalValue); }
      if (!updates.length) return res.json({ message: 'Nothing to update' });
      params.push(req.params.id);
      await db.execute(`UPDATE pcns SET ${updates.join(', ')} WHERE id = ?`, params);
      const [rows] = await db.execute('SELECT * FROM pcns WHERE id=?', [req.params.id]);
      res.json(rows[0] || {});
    } catch (err) {
      console.error('[PCNs] PUT error:', err.message);
      res.status(500).json({ error: 'Error updating PCN' });
    }
  });

  router.delete('/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      await getDb().execute('DELETE FROM pcns WHERE id=?', [req.params.id]);
      res.json({ message: 'PCN deleted' });
    } catch (err) {
      console.error('[PCNs] DELETE error:', err.message);
      res.status(500).json({ error: 'Error deleting PCN' });
    }
  });

  return router;
};
