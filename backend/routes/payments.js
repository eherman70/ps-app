'use strict';
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { isSupervisor } = require('../auth');

module.exports = function paymentsRouter(getDb, auth) {
  const router = Router();

  router.get('/', auth, async (req, res) => {
    try {
      const db = getDb();
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
    } catch (err) {
      console.error('[Payments] GET error:', err.message);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.post('/', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
              exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps } = req.body;
      const id = uuidv4();
      const effectivePs = ps || req.user.ps;
      await getDb().execute(
        `INSERT INTO payments (id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
           exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, farmerId, pcnId || null, tobaccoAmount, inputDeduction, usdBalance || 0,
         exchangeRate || 0, tzsGross || 0, levy || 0, adminFee || 0, totalDeductions || 0,
         netPayment, paymentDate, effectivePs,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
                 exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps: effectivePs });
    } catch (err) {
      console.error('[Payments] POST error:', err.message);
      res.status(500).json({ error: 'Error creating payment' });
    }
  });

  router.delete('/:id', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      await getDb().execute('DELETE FROM payments WHERE id=?', [req.params.id]);
      res.json({ message: 'Payment deleted' });
    } catch (err) {
      console.error('[Payments] DELETE error:', err.message);
      res.status(500).json({ error: 'Error deleting payment' });
    }
  });

  return router;
};
