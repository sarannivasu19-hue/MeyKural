/**
 * SQLite Database Access Layer for MeyKural
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'sqlite', 'kural.db');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { fileMustExist: true });
    dbInstance.pragma('journal_mode = WAL');
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS verification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      result_status TEXT NOT NULL,
      wrong_words_count INTEGER DEFAULT 0,
      kural_number INTEGER,
      source_ai TEXT DEFAULT 'Not from AI',
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function createUser(username, email, passwordHash, role = 'user') {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(username, email || null, passwordHash, role);
  return { id: info.lastInsertRowid, username, email, role };
}

function getUserByUsername(username) {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ?`);
  return stmt.get(username);
}

function getUserById(id) {
  const db = getDb();
  const stmt = db.prepare(`SELECT id, username, email, role, created_at FROM users WHERE id = ?`);
  return stmt.get(id);
}

function getAllUsers() {
  const db = getDb();
  const stmt = db.prepare(`SELECT id, username, email, role, created_at FROM users ORDER BY id DESC`);
  return stmt.all();
}

function logVerification({ inputText, resultStatus, wrongWordsCount = 0, kuralNumber = null, sourceAi = 'Not from AI', ip = '' }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO verification_logs (input_text, result_status, wrong_words_count, kural_number, source_ai, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(inputText, resultStatus, wrongWordsCount, kuralNumber, sourceAi, ip);
  return info.lastInsertRowid;
}

function getVerificationLogs(options = {}) {
  const db = getDb();
  const { limit = 50, offset = 0, search = '', status = '', sourceAi = '' } = options;
  let sql = `SELECT * FROM verification_logs WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ` AND input_text LIKE ?`;
    params.push(`%${search}%`);
  }
  if (status) {
    sql += ` AND result_status = ?`;
    params.push(status);
  }
  if (sourceAi) {
    sql += ` AND source_ai = ?`;
    params.push(sourceAi);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM verification_logs`).get();
  return { logs: rows, total: countRow.total };
}

function getVerificationStats() {
  const db = getDb();
  const bySource = db.prepare(`
    SELECT source_ai,
           COUNT(*) as total_checks,
           SUM(CASE WHEN result_status = 'verified' THEN 1 ELSE 0 END) as verified_count,
           SUM(CASE WHEN result_status = 'near_match' THEN 1 ELSE 0 END) as near_match_count,
           SUM(CASE WHEN result_status = 'not_found' THEN 1 ELSE 0 END) as not_found_count
    FROM verification_logs
    GROUP BY source_ai
  `).all();

  const totalChecks = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs`).get().cnt;
  const verifiedTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'verified'`).get().cnt;
  const nearMatchTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'near_match'`).get().cnt;
  const notFoundTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'not_found'`).get().cnt;

  return {
    totalChecks,
    verifiedTotal,
    nearMatchTotal,
    notFoundTotal,
    bySource
  };
}

function getSetting(key, defaultValue = null) {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(key);
  return row ? JSON.parse(row.value) : defaultValue;
}

function setSetting(key, value) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, JSON.stringify(value));
}

function getCoupletByNumber(number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT k.*, c.name as chapter_name, c.translation as chapter_translation,
           c.section_name, c.section_translation, c.group_name
    FROM kurals k
    JOIN chapters c ON k.chapter_number = c.number
    WHERE k.number = ?
  `);
  return stmt.get(number);
}

function getCoupletsByChapter(chapterNumber) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT k.*, c.name as chapter_name, c.translation as chapter_translation
    FROM kurals k
    JOIN chapters c ON k.chapter_number = c.number
    WHERE k.chapter_number = ?
    ORDER BY k.number ASC
  `);
  return stmt.all(chapterNumber);
}

function getAllChapters() {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM chapters ORDER BY number ASC`);
  return stmt.all();
}

function searchKurals(query, options = {}) {
  const db = getDb();
  const { chapter, section, loveOnly, limit = 20, offset = 0 } = options;

  let sql = `
    SELECT k.*, c.name as chapter_name, c.translation as chapter_translation
    FROM kurals k
    JOIN chapters c ON k.chapter_number = c.number
    WHERE 1=1
  `;
  const params = [];

  if (loveOnly) {
    sql += ` AND k.chapter_number BETWEEN 109 AND 133`;
  } else if (chapter) {
    sql += ` AND k.chapter_number = ?`;
    params.push(Number(chapter));
  } else if (section) {
    sql += ` AND k.section_number = ?`;
    params.push(Number(section));
  }

  if (query && query.trim()) {
    const term = `%${query.trim()}%`;
    sql += ` AND (k.couplet LIKE ? OR k.meaning_mv LIKE ? OR k.meaning_sp LIKE ? OR k.translation_en LIKE ?)`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY k.number ASC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

module.exports = {
  getDb,
  createUser,
  getUserByUsername,
  getUserById,
  getAllUsers,
  logVerification,
  getVerificationLogs,
  getVerificationStats,
  getSetting,
  setSetting,
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  searchKurals
};
