'use strict';
const { Router } = require('express');
const { isSupervisor } = require('../auth');

module.exports = function settingsRouter(getDb, auth) {
  const router = Router();

  const upsert = (key, value) => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return getDb().execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [key, JSON.stringify(value), now]
    );
  };

  const getKey = async (key, fallback) => {
    const [rows] = await getDb().execute("SELECT value FROM system_settings WHERE key=?", [key]);
    return rows.length ? JSON.parse(rows[0].value) : fallback;
  };

  // Exchange rate (single)
  router.get('/exchange-rate', auth, async (req, res) => {
    try { res.json(await getKey('exchange_rate', { rate: '', locked: false })); }
    catch (err) { res.status(500).json({ error: 'Database error' }); }
  });
  router.post('/exchange-rate', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Supervisors only' });
      const { rate, locked } = req.body;
      await upsert('exchange_rate', { rate, locked });
      res.json({ rate, locked });
    } catch (err) { res.status(500).json({ error: 'Error saving exchange rate' }); }
  });

  // Exchange rates (by PS)
  router.get('/exchange-rates', auth, async (req, res) => {
    try { res.json(await getKey('exchange_rates_by_ps', { byPs: {} })); }
    catch (err) { res.status(500).json({ error: 'Database error' }); }
  });
  router.post('/exchange-rates', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Supervisors only' });
      const payload = { byPs: (req.body?.byPs && typeof req.body.byPs === 'object') ? req.body.byPs : {} };
      await upsert('exchange_rates_by_ps', payload);
      res.json(payload);
    } catch (err) { res.status(500).json({ error: 'Error saving exchange rates' }); }
  });

  // TZS deductions (by PS)
  router.get('/tzs-deductions', auth, async (req, res) => {
    try { res.json(await getKey('tzs_deductions_by_ps', { byPs: {} })); }
    catch (err) { res.status(500).json({ error: 'Database error' }); }
  });
  router.post('/tzs-deductions', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Supervisors only' });
      const payload = { byPs: (req.body?.byPs && typeof req.body.byPs === 'object') ? req.body.byPs : {} };
      await upsert('tzs_deductions_by_ps', payload);
      res.json(payload);
    } catch (err) { res.status(500).json({ error: 'Error saving TZS deductions' }); }
  });

  // Deduction rates
  router.get('/deduction-rates', auth, async (req, res) => {
    try { res.json(await getKey('deduction_rates', { default: { levyRate: 2, adminFeeRate: 1 }, byPs: {} })); }
    catch (err) { res.status(500).json({ error: 'Database error' }); }
  });
  router.post('/deduction-rates', auth, async (req, res) => {
    try {
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Supervisors only' });
      const payload = req.body || {};
      const safe = {
        default: { levyRate: Number(payload?.default?.levyRate ?? 2), adminFeeRate: Number(payload?.default?.adminFeeRate ?? 1) },
        byPs: {}
      };
      if (payload?.byPs && typeof payload.byPs === 'object') {
        for (const [psCode, rates] of Object.entries(payload.byPs)) {
          safe.byPs[psCode] = {
            levyRate: Number(rates?.levyRate ?? safe.default.levyRate),
            adminFeeRate: Number(rates?.adminFeeRate ?? safe.default.adminFeeRate)
          };
        }
      }
      await upsert('deduction_rates', safe);
      res.json(safe);
    } catch (err) { res.status(500).json({ error: 'Error saving deduction rates' }); }
  });

  return router;
};
