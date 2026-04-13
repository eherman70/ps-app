'use strict';
const { Router } = require('express');
const { isSupervisor } = require('../auth');

module.exports = function reportsRouter(getDb, auth) {
  const router = Router();

  // Sales by Sale Number summary
  router.get('/sales-by-sale', auth, async (req, res) => {
    try {
      const db = getDb();
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
    } catch (err) {
      console.error('[Reports] sales-by-sale error:', err.message);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};
