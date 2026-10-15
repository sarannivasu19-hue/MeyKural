/**
 * மெய்க்குறள் (MeyKural) Authentication Module
 * - Strict bcrypt password hashing (cost 12) with explicit await
 * - JWT in httpOnly, Secure, SameSite=Strict cookie
 * - Per-IP and Per-Account rate limiting with 1-minute lockout after 5 failures
 * - Role separation: Admin vs User
 * - Admin account seeding (default 1906, hashed, never logged)
 * - Protected API middleware (401 unauthenticated, 403 unauthorized)
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In-memory rate-limit store: key -> { count, lockedUntil }
// Keys format: "ip:<ip>" and "account:<username>"
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 1000; // 1 minute

let adminHash = null;
let adminUsername = null;

/**
 * Seed the admin account once on server startup.
 * Uses ADMIN_PASSWORD_DEFAULT from .env (default: 1906). Never logs password.
 */
async function seedAdminAccount() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const rawPassword = process.env.ADMIN_PASSWORD_DEFAULT || '1906';
  
  adminHash = await bcrypt.hash(rawPassword, 12);
  adminUsername = username.trim().toLowerCase();

  try {
    const { getDb, createUser } = require('./db');
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)').get(username.trim());
    if (!existing) {
      createUser(username.trim(), 'admin@meikkural.local', adminHash, 'admin');
      console.log(`✅ Admin account seeded in SQLite database (username: ${username}). Password stored as bcrypt hash.`);
    } else {
      db.prepare(`UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?`).run(adminHash, existing.id);
      console.log(`✅ Admin account updated in SQLite database (username: ${username}). Password stored as bcrypt hash.`);
    }
  } catch (err) {
    console.warn('⚠️ Note on SQLite admin user seeding:', err.message);
  }
}

/**
 * Rate-limit check supporting both IP and account key.
 */
function checkRateLimit(ip, username = '') {
  const now = Date.now();
  const keys = [`ip:${ip || 'unknown'}`];
  if (username && typeof username === 'string' && username.trim()) {
    keys.push(`account:${username.trim().toLowerCase()}`);
  }

  for (const k of keys) {
    const record = loginAttempts.get(k);
    if (record && record.lockedUntil > now) {
      return { allowed: false, retryAfterMs: record.lockedUntil - now, key: k };
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordFailedAttempt(ip, username = '') {
  const now = Date.now();
  const keys = [`ip:${ip || 'unknown'}`];
  if (username && typeof username === 'string' && username.trim()) {
    keys.push(`account:${username.trim().toLowerCase()}`);
  }

  for (const k of keys) {
    const record = loginAttempts.get(k) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCK_DURATION_MS;
      record.count = 0; // reset counter after locking
    }
    loginAttempts.set(k, record);
  }
}

function clearAttempts(ip, username = '') {
  loginAttempts.delete(`ip:${ip || 'unknown'}`);
  if (username && typeof username === 'string' && username.trim()) {
    loginAttempts.delete(`account:${username.trim().toLowerCase()}`);
  }
}

/**
 * Verify admin credentials.
 * Strict role = 'admin' in SQLite. Uses explicit await bcrypt.compare.
 */
async function verifyAdminCredentials(username, password) {
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }
  const { getDb } = require('./db');
  const db = getDb();
  const cleanUser = username.trim().toLowerCase();
  const adminUser = db.prepare("SELECT * FROM users WHERE LOWER(TRIM(username)) = ? AND role = 'admin'").get(cleanUser);
  if (!adminUser || !adminUser.password_hash) return false;
  
  const match = await bcrypt.compare(password, adminUser.password_hash);
  return Boolean(match);
}

/**
 * Issue signed JWT in an httpOnly, Secure, SameSite=Strict cookie with short expiry.
 */
function issueToken(res, payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const token = jwt.sign(payload, secret, { expiresIn: '4h' });
  res.cookie('meikkural_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 4 * 60 * 60 * 1000 // 4 hours
  });
  return token;
}

/**
 * Express middleware: require valid JWT cookie or Bearer token.
 */
function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const token = req.cookies?.meikkural_token || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * Express middleware: require admin role.
 */
function requireAdmin(req, res, next) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const token = req.cookies?.meikkural_token || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const payload = jwt.verify(token, secret);
    if (!payload || payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

const { createUser } = require('./db');

/**
 * Register normal user with role 'user'.
 * Blocks reserved names ('admin', 'administrator') and duplicate usernames.
 */
async function registerUser(username, email, password) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('பயனர்பெயர் தேவை (Username is required).');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('கடவுச்சொல் குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும் (Password must be at least 6 characters).');
  }

  const cleanName = username.trim().normalize('NFC');
  const lowerName = cleanName.toLowerCase();

  // Block reserved admin names
  if (lowerName === 'admin' || lowerName === 'administrator') {
    throw new Error('இந்த பயனர்பெயர் பாதுகாக்கப்பட்டது. பதிவு செய்ய முடியாது (Username "admin" is reserved).');
  }

  if (cleanName.length > 50) {
    throw new Error('Username must not exceed 50 characters.');
  }

  const { getDb } = require('./db');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?)').get(cleanName);
  if (existing) {
    throw new Error('இந்த பயனர்பெயர் ஏற்கனவே உள்ளது (Username already taken).');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return createUser(cleanName, (email && typeof email === 'string') ? email.trim() : null, passwordHash, 'user');
}

/**
 * Verify normal user credentials.
 * Works ONLY for registered users with role 'user'.
 * Admin credentials return not_found.
 */
async function verifyUserCredentials(username, password) {
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return { status: 'not_found' };
  }
  const { getDb } = require('./db');
  const db = getDb();
  const cleanName = username.trim().normalize('NFC');
  const user = db.prepare('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)').get(cleanName);

  if (!user || user.role !== 'user' || !user.password_hash) {
    return { status: 'not_found' };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { status: 'wrong_password' };
  }

  return { status: 'ok', user: { id: user.id, username: user.username, email: user.email, role: 'user' } };
}

module.exports = {
  seedAdminAccount,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  verifyAdminCredentials,
  registerUser,
  verifyUserCredentials,
  issueToken,
  requireAuth,
  requireAdmin
};
