'use strict';
/**
 * routes/tickets.js — Ticket CRUD, duplicate check, PCN sync
 * Each route has its own error boundary — a failure here doesn't touch other modules.
 */

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { isSupervisor } = require('../auth');

async function syncPCNRecord(db, pcnNumber, saleNumberId, effectivePs) {
  if (!pcnNumber) return;
  try {
    let saleNumberStr = '';
    if (saleNumberId) {
      const [snRows] = await db.execute('SELECT saleNumber FROM sale_numbers WHERE id = ?', [saleNumberId]);
      if (snRows.length) saleNumberStr = snRows[0].saleNumber;
    }

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
      if (snRows.length) saleNumberStr = snRows[0].saleNumber;
    }

    const finalPs = (effectivePs && effectivePs !== 'All') ? effectivePs : (stats.latestPs || 'All');
    const [existing] = await db.execute('SELECT id FROM pcns WHERE pcnNumber = ?', [pcnNumber]);

    if (existing.length) {
      await db.execute(`
        UPDATE pcns SET totalTickets=?, totalWeight=?, totalValue=?, totalFarmers=?,
          saleNumber=COALESCE(NULLIF(?, ''), saleNumber), ps=?
        WHERE pcnNumber=?`,
        [stats.totalTickets, stats.totalWeight || 0, stats.totalValue || 0,
         stats.totalFarmers || 0, saleNumberStr, finalPs, pcnNumber]);
    } else {
      await db.execute(`
        INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)`,
        [uuidv4(), pcnNumber, saleNumberStr || 'TBD', finalPs,
         stats.totalFarmers || 0, stats.totalTickets, stats.totalWeight || 0, stats.totalValue || 0,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    }
  } catch (err) {
    console.error('[Tickets] PCN sync error:', err.message);
  }
}

module.exports = function ticketsRouter(getDb, auth) {
  const router = Router();

  // ── LIST (paginated) ──────────────────────────────────────────────────────
  router.get('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const supervisor = isSupervisor(req.user);
      const psFilter = req.user.ps || 'All';

      const limit  = Math.min(parseInt(req.query.limit)  || 300, 1000);
      const page   = Math.max(parseInt(req.query.page)   || 1, 1);
      const offset = (page - 1) * limit;

      // Optional filters
      const { pcnNumber, saleNumberId, captureDate } = req.query;

      let whereParts = [];
      let params = [];

      if (!supervisor) {
        whereParts.push("(t.ps = 'All' OR t.ps = ?)");
        params.push(psFilter);
      }
      if (pcnNumber)    { whereParts.push('t.pcnNumber = ?');    params.push(pcnNumber); }
      if (saleNumberId) { whereParts.push('t.saleNumberId = ?'); params.push(saleNumberId); }
      if (captureDate)  { whereParts.push('t.captureDate = ?');  params.push(captureDate); }

      const whereClause = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

      const [countRows] = await db.execute(
        `SELECT COUNT(*) as total FROM tickets t ${whereClause}`, params
      );
      const total = parseInt(countRows[0]?.total || countRows[0]?.count || 0);

      const [rows] = await db.execute(
        `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
                g.name as gradeName, g.grade_code as gCode, g.category as gradeCategory, g.quality_level as gradeLevel,
                mc.name as marketCenterName, sn.saleNumber
         FROM tickets t
         JOIN farmers f ON t.farmerId = f.id
         JOIN grades g ON t.gradeId = g.id
         JOIN market_centers mc ON t.marketCenterId = mc.id
         JOIN sale_numbers sn ON t.saleNumberId = sn.id
         ${whereClause}
         ORDER BY t.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({ data: rows, total, page, pages: Math.ceil(total / limit), limit });
    } catch (err) {
      console.error('[Tickets] GET error:', err.message);
      res.status(500).json({ error: 'Failed to load tickets' });
    }
  });

  // ── CHECK DUPLICATE ───────────────────────────────────────────────────────
  router.get('/check/:ticketNumber', auth, async (req, res) => {
    try {
      const db = getDb();
      const supervisor = isSupervisor(req.user);
      const psFilter = req.user.ps || 'All';
      const whereClause = supervisor
        ? 'WHERE t.ticketNumber = ?'
        : "WHERE t.ticketNumber = ? AND (t.ps = 'All' OR t.ps = ?)";
      const params = supervisor ? [req.params.ticketNumber] : [req.params.ticketNumber, psFilter];

      const [rows] = await db.execute(
        `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
                g.name as gradeName, g.grade_code as gCode, mc.name as marketCenterName, sn.saleNumber
         FROM tickets t
         JOIN farmers f ON t.farmerId = f.id
         JOIN grades g ON t.gradeId = g.id
         JOIN market_centers mc ON t.marketCenterId = mc.id
         JOIN sale_numbers sn ON t.saleNumberId = sn.id
         ${whereClause}`, params
      );
      res.json(rows.length ? { exists: true, ticket: rows[0] } : { exists: false });
    } catch (err) {
      console.error('[Tickets] CHECK error:', err.message);
      res.status(500).json({ error: 'Check failed' });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────
  router.post('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const { ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId, saleNumberId,
              grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps } = req.body;
      const id = uuidv4();
      const supervisor = isSupervisor(req.user);
      const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

      // PCN business rules
      if (pcnNumber) {
        const [pcnCheck] = await db.execute(
          'SELECT saleNumberId, ps FROM tickets WHERE pcnNumber = ? LIMIT 1', [pcnNumber]
        );
        if (pcnCheck.length && (pcnCheck[0].saleNumberId !== saleNumberId || pcnCheck[0].ps !== effectivePs)) {
          return res.status(400).json({ error: 'PCN Mixing Violation',
            message: 'This PCN is already linked to a different Sale Number or Primary Society.' });
        }
        const [countCheck] = await db.execute(
          'SELECT COUNT(*) as count FROM tickets WHERE pcnNumber = ?', [pcnNumber]
        );
        if (countCheck[0].count >= 25) {
          return res.status(400).json({ error: 'PCN Limit Reached',
            message: 'A PCN cannot contain more than 25 tickets.' });
        }
      }

      if (!supervisor) {
        const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id = ?', [farmerId]);
        if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
          return res.status(403).json({ error: 'Not allowed to create ticket for this farmer' });
        }
      }

      await db.execute(
        `INSERT INTO tickets (id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId,
           saleNumberId, grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId, saleNumberId,
         grossWeight, tareWeight || 0, netWeight, pricePerKg, totalValue, captureDate, effectivePs,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );

      if (pcnNumber) await syncPCNRecord(db, pcnNumber, saleNumberId, effectivePs);

      res.json({ id, ticketNumber, pcnNumber, farmerId, gradeId, grade_code, marketCenterId,
                 saleNumberId, grossWeight, tareWeight, netWeight, pricePerKg, totalValue,
                 captureDate, ps: effectivePs });
    } catch (err) {
      if (err.code === '23505' || (err.message && err.message.includes('UNIQUE') && err.message.includes('ticketNumber'))) {
        return res.status(409).json({ error: 'Ticket already exists',
          message: 'This ticket number has already been captured. Supervisors can update it.' });
      }
      console.error('[Tickets] POST error:', err.message);
      res.status(500).json({ error: 'Error creating ticket' });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  router.put('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update tickets' });
      const { farmerId, gradeId, marketCenterId, saleNumberId,
              grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber } = req.body;

      if (pcnNumber) {
        const [pcnCheck] = await db.execute(
          'SELECT saleNumberId, ps FROM tickets WHERE pcnNumber = ? AND id != ? LIMIT 1',
          [pcnNumber, req.params.id]
        );
        if (pcnCheck.length) {
          const psValue = isSupervisor(req.user) ? (req.body.ps || pcnCheck[0].ps) : req.user.ps;
          if (pcnCheck[0].saleNumberId !== saleNumberId || pcnCheck[0].ps !== psValue) {
            return res.status(400).json({ error: 'PCN Mixing Violation',
              message: 'This PCN is already linked to a different Sale Number or Primary Society.' });
          }
        }
        const [countCheck] = await db.execute(
          'SELECT COUNT(*) as count FROM tickets WHERE pcnNumber = ? AND id != ?', [pcnNumber, req.params.id]
        );
        if (countCheck[0].count >= 25) {
          return res.status(400).json({ error: 'PCN Limit Reached', message: 'Max 25 tickets per PCN.' });
        }
      }

      const [oldTicket] = await db.execute('SELECT pcnNumber FROM tickets WHERE id = ?', [req.params.id]);
      const oldPcn = oldTicket.length ? oldTicket[0].pcnNumber : null;

      await db.execute(
        `UPDATE tickets SET farmerId=?, gradeId=?, marketCenterId=?, saleNumberId=?,
           grossWeight=?, tareWeight=?, netWeight=?, pricePerKg=?, totalValue=?,
           captureDate=?, pcnNumber=? WHERE id=?`,
        [farmerId, gradeId, marketCenterId, saleNumberId,
         grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber, req.params.id]
      );

      if (pcnNumber) await syncPCNRecord(db, pcnNumber, saleNumberId, req.user.ps);
      if (oldPcn && oldPcn !== pcnNumber) await syncPCNRecord(db, oldPcn, null, req.user.ps);

      res.json({ id: req.params.id, message: 'Ticket updated' });
    } catch (err) {
      console.error('[Tickets] PUT error:', err.message);
      res.status(500).json({ error: 'Error updating ticket' });
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  router.delete('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const [ticket] = await db.execute('SELECT pcnNumber FROM tickets WHERE id = ?', [req.params.id]);
      const pcn = ticket.length ? ticket[0].pcnNumber : null;
      await db.execute('DELETE FROM tickets WHERE id=?', [req.params.id]);
      if (pcn) await syncPCNRecord(db, pcn, null, req.user.ps);
      res.json({ message: 'Ticket deleted' });
    } catch (err) {
      console.error('[Tickets] DELETE error:', err.message);
      res.status(500).json({ error: 'Error deleting ticket' });
    }
  });

  return router;
};
