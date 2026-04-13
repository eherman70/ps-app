'use strict';
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isSupervisor, invalidateCachedUser, authRateLimiter, JWT_SECRET } = require('../auth');

module.exports = function usersRouter(getDb, auth) {
  const router = Router();

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  router.post('/login', authRateLimiter, async (req, res) => {
    try {
      const db = getDb();
      const { username, password } = req.body;
      const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
      if (!rows.length) return res.status(401).json({ error: 'User not found' });
      const user = rows[0];
      if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid password' });
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, ps: user.ps }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, fullName: user.fullName,
        role: user.role, ps: user.ps, darkMode: Boolean(user.darkMode), testMode: Boolean(user.testMode) } });
    } catch (err) {
      console.error('[Auth] Login error:', err.message);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  router.post('/register', authRateLimiter, async (req, res) => {
    try {
      const db = getDb();
      const { username, password, fullName, ps } = req.body;
      const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length) return res.status(400).json({ error: 'Username already exists' });
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = uuidv4();
      const role = 'Clerk';
      const effectivePs = ps || 'All';
      await db.execute(
        'INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, username, hashedPassword, fullName, role, effectivePs, 0, 0,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      const token = jwt.sign({ id, username, role, ps: effectivePs }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id, username, fullName, role, ps: effectivePs, darkMode: false, testMode: false } });
    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  router.get('/me', auth, (req, res) => res.json({ user: req.user }));

  // ─── USERS CRUD ───────────────────────────────────────────────────────────
  router.get('/', auth, async (req, res) => {
    try {
      const db = getDb();
      const supervisor = isSupervisor(req.user);
      const psFilter = req.user.ps || 'All';
      const query = supervisor
        ? 'SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users'
        : "SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users WHERE ps = 'All' OR ps = ?";
      const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
      res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
  });

  router.post('/', auth, async (req, res) => {
    try {
      const db = getDb();
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const { username, password, fullName, role, ps } = req.body;
      const effectivePs = isSupervisor(req.user) ? (ps || 'All') : req.user.ps;
      const [psRows] = await db.execute('SELECT id FROM primary_societies WHERE code = ?', [effectivePs]);
      if (!psRows.length && effectivePs !== 'All') return res.status(400).json({ error: 'Invalid Primary Society code' });
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = uuidv4();
      await db.execute(
        'INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, username, hashedPassword, fullName, role || 'Clerk', effectivePs, 0, 0,
         new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      res.json({ id, username, fullName, role: role || 'Clerk', ps: effectivePs });
    } catch (err) { res.status(500).json({ error: 'Error creating user' }); }
  });

  router.put('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      const targetId = req.params.id;
      const isSelf = req.user.id === targetId;
      const supervisor = isSupervisor(req.user);
      if (!supervisor && !isSelf) return res.status(403).json({ error: 'Access denied' });

      const { fullName, role, ps, password, darkMode, testMode } = req.body;
      const updates = []; const params = [];
      if (fullName  !== undefined) { updates.push('fullName = ?');  params.push(fullName); }
      if (darkMode  !== undefined) { updates.push('darkMode = ?');  params.push(darkMode ? 1 : 0); }
      if (testMode  !== undefined && supervisor) { updates.push('testMode = ?'); params.push(testMode ? 1 : 0); }
      if (role      !== undefined && supervisor) { updates.push('role = ?');     params.push(role); }
      if (ps        !== undefined && supervisor) { updates.push('ps = ?');       params.push(ps); }
      if (password) { updates.push('password = ?'); params.push(bcrypt.hashSync(password, 10)); }
      if (!updates.length) return res.json({ message: 'Nothing to update' });

      params.push(targetId);
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      invalidateCachedUser(targetId);

      const [rows] = await db.execute(
        'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?', [targetId]
      );
      res.json(rows[0] || {});
    } catch (err) { res.status(500).json({ error: 'Error updating user' }); }
  });

  router.delete('/:id', auth, async (req, res) => {
    try {
      const db = getDb();
      if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
      const [rows] = await db.execute('SELECT username FROM users WHERE id = ?', [req.params.id]);
      if (rows.length && rows[0].username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
      await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
      invalidateCachedUser(req.params.id);
      res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: 'Error deleting user' }); }
  });

  return router;
};
