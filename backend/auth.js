'use strict';
/**
 * auth.js — JWT authentication middleware + role helpers + user cache
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ── In-memory user cache (avoids DB hit on every authenticated request) ──────
const USER_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX = 1000;

function cacheUser(userId, user) {
  if (USER_CACHE.size >= CACHE_MAX) {
    USER_CACHE.delete(USER_CACHE.keys().next().value); // evict oldest
  }
  USER_CACHE.set(userId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCachedUser(userId) {
  const entry = USER_CACHE.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { USER_CACHE.delete(userId); return null; }
  return entry.user;
}

function invalidateCachedUser(userId) {
  USER_CACHE.delete(userId);
}

// ── Middleware ────────────────────────────────────────────────────────────────
function makeAuthMiddleware(getDb) {
  return async function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const cached = getCachedUser(decoded.id);
    if (cached) { req.user = cached; return next(); }

    try {
      const db = getDb();
      const [rows] = await db.execute(
        'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?',
        [decoded.id]
      );
      if (!rows.length) return res.status(401).json({ error: 'User not found' });
      cacheUser(decoded.id, rows[0]);
      req.user = rows[0];
      next();
    } catch (dbErr) {
      console.error('[AUTH] DB lookup failed:', dbErr.message);
      res.status(503).json({ error: 'Auth service temporarily unavailable' });
    }
  };
}

// ── Role helpers ─────────────────────────────────────────────────────────────
function isSupervisor(user) {
  return user.role === 'Supervisor' || user.role === 'Admin';
}

function canAccessPs(user, recordPs) {
  if (isSupervisor(user)) return true;
  const userPs = user?.ps || 'All';
  return recordPs === 'All' || recordPs === userPs;
}

// ── Auth-endpoint rate limiter ────────────────────────────────────────────────
const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = 30;

function authRateLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > AUTH_MAX) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of authAttempts.entries()) if (now > e.resetAt) authAttempts.delete(ip);
}, AUTH_WINDOW_MS).unref();

module.exports = {
  makeAuthMiddleware,
  invalidateCachedUser,
  isSupervisor,
  canAccessPs,
  authRateLimiter,
  JWT_SECRET,
};
