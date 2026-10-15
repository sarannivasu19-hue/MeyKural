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
      is_demo INTEGER DEFAULT 0,
      claimed_adhikaram TEXT,
      claimed_kural_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS known_fakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fake_text TEXT UNIQUE NOT NULL,
      source_ai TEXT NOT NULL,
      detection_count INTEGER DEFAULT 1,
      claimed_adhikaram TEXT,
      claimed_kural_number INTEGER,
      is_demo INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec(`ALTER TABLE verification_logs ADD COLUMN is_demo INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE verification_logs ADD COLUMN claimed_adhikaram TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE verification_logs ADD COLUMN claimed_kural_number INTEGER`);
  } catch {}
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

function logVerification({ inputText, resultStatus, wrongWordsCount = 0, kuralNumber = null, sourceAi = 'Not from AI', ip = '', isDemo = 0, claimedAdhikaram = null, claimedKuralNumber = null }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO verification_logs (input_text, result_status, wrong_words_count, kural_number, source_ai, ip, is_demo, claimed_adhikaram, claimed_kural_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(inputText, resultStatus, wrongWordsCount, kuralNumber, sourceAi, ip, isDemo ? 1 : 0, claimedAdhikaram || null, claimedKuralNumber || null);
  return info.lastInsertRowid;
}

function getVerificationLogs(options = {}) {
  const db = getDb();
  const { limit = 50, offset = 0, search = '', status = '', sourceAi = '', range = 'all' } = options;
  const whereClauses = ['1=1'];
  const params = [];
  const countParams = [];

  if (range === 'today') {
    whereClauses.push(`created_at >= datetime('now', 'start of day')`);
  } else if (range === '7d') {
    whereClauses.push(`created_at >= datetime('now', '-7 days')`);
  } else if (range === '30d') {
    whereClauses.push(`created_at >= datetime('now', '-30 days')`);
  }

  if (search && search.trim()) {
    whereClauses.push(`input_text LIKE ?`);
    const term = `%${search.trim()}%`;
    params.push(term);
    countParams.push(term);
  }

  if (status && status.trim()) {
    const s = status.trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'verified') {
      whereClauses.push(`LOWER(result_status) = 'verified'`);
    } else if (s === 'near_match') {
      whereClauses.push(`(LOWER(result_status) = 'near_match' OR LOWER(result_status) = 'near match')`);
    } else if (s === 'not_found') {
      whereClauses.push(`(LOWER(result_status) = 'not_found' OR LOWER(result_status) = 'not found')`);
    } else {
      whereClauses.push(`LOWER(result_status) = ?`);
      params.push(s);
      countParams.push(s);
    }
  }

  if (sourceAi && sourceAi.trim()) {
    whereClauses.push(`source_ai = ?`);
    params.push(sourceAi.trim());
    countParams.push(sourceAi.trim());
  }

  const whereSql = whereClauses.join(' AND ');
  const sql = `SELECT * FROM verification_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as total FROM verification_logs WHERE ${whereSql}`;

  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));
  const countRow = db.prepare(countSql).get(...countParams);

  return { logs: rows, total: countRow ? countRow.total : 0 };
}

function getReportStats(range = 'all') {
  const db = getDb();
  let dateFilter = '';
  if (range === 'today') {
    dateFilter = " AND created_at >= datetime('now', 'start of day')";
  } else if (range === '7d') {
    dateFilter = " AND created_at >= datetime('now', '-7 days')";
  } else if (range === '30d') {
    dateFilter = " AND created_at >= datetime('now', '-30 days')";
  }

  const totalChecks = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE 1=1 ${dateFilter}`).get().cnt;
  const verifiedTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'verified' ${dateFilter}`).get().cnt;
  const nearMatchTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'near_match' ${dateFilter}`).get().cnt;
  const notFoundTotal = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE result_status = 'not_found' ${dateFilter}`).get().cnt;

  const bySource = db.prepare(`
    SELECT source_ai,
           COUNT(*) as total_checks,
           SUM(CASE WHEN result_status = 'verified' THEN 1 ELSE 0 END) as verified_count,
           SUM(CASE WHEN result_status = 'near_match' THEN 1 ELSE 0 END) as near_match_count,
           SUM(CASE WHEN result_status = 'not_found' THEN 1 ELSE 0 END) as not_found_count
    FROM verification_logs
    WHERE source_ai IS NOT NULL AND source_ai != '' ${dateFilter}
    GROUP BY source_ai
    ORDER BY total_checks DESC
  `).all();

  const demoCountLogs = db.prepare(`SELECT COUNT(*) as cnt FROM verification_logs WHERE is_demo = 1`).get().cnt;
  const demoCountFakes = db.prepare(`SELECT COUNT(*) as cnt FROM known_fakes WHERE is_demo = 1`).get().cnt;
  const hasDemoData = (demoCountLogs + demoCountFakes) > 0;

  const totalKnownFakes = db.prepare(`SELECT COUNT(*) as cnt FROM known_fakes`).get().cnt;

  return {
    totalChecks,
    verifiedTotal,
    nearMatchTotal,
    notFoundTotal,
    bySource,
    hasDemoData,
    totalKnownFakes,
    range
  };
}

function getSourceDetails(sourceAi) {
  const db = getDb();
  const recentChecks = db.prepare(`
    SELECT id, input_text, result_status, wrong_words_count, kural_number, created_at
    FROM verification_logs
    WHERE source_ai = ?
    ORDER BY created_at DESC
    LIMIT 8
  `).all(sourceAi);

  const topFakes = db.prepare(`
    SELECT id, fake_text, detection_count, claimed_adhikaram, claimed_kural_number, updated_at
    FROM known_fakes
    WHERE source_ai LIKE '%' || ? || '%'
    ORDER BY detection_count DESC, id DESC
    LIMIT 6
  `).all(sourceAi);

  return {
    sourceAi,
    recentChecks,
    topFakes
  };
}

function recordKnownFake({ fakeText, sourceAi, claimedAdhikaram = null, claimedKuralNumber = null, isDemo = 0 }) {
  if (!fakeText || !fakeText.trim()) return null;
  const db = getDb();
  const normalized = fakeText.trim().replace(/\r\n/g, '\n');
  const stmt = db.prepare(`
    INSERT INTO known_fakes (fake_text, source_ai, detection_count, claimed_adhikaram, claimed_kural_number, is_demo, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(fake_text) DO UPDATE SET
      detection_count = detection_count + 1,
      claimed_adhikaram = COALESCE(excluded.claimed_adhikaram, known_fakes.claimed_adhikaram),
      claimed_kural_number = COALESCE(excluded.claimed_kural_number, known_fakes.claimed_kural_number),
      updated_at = CURRENT_TIMESTAMP,
      source_ai = CASE 
        WHEN known_fakes.source_ai LIKE '%' || excluded.source_ai || '%' THEN known_fakes.source_ai 
        ELSE known_fakes.source_ai || ', ' || excluded.source_ai 
      END
  `);
  stmt.run(normalized, sourceAi || 'Unknown', claimedAdhikaram, claimedKuralNumber, isDemo ? 1 : 0);
  return db.prepare(`SELECT * FROM known_fakes WHERE fake_text = ?`).get(normalized);
}

function checkKnownFake(text) {
  if (!text || !text.trim()) return null;
  const db = getDb();
  const normalized = text.trim().replace(/\r\n/g, '\n');
  const row = db.prepare(`SELECT * FROM known_fakes WHERE fake_text = ?`).get(normalized);
  if (row) return row;
  
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const candidate = `${lines[0]}\n${lines[1]}`;
    return db.prepare(`SELECT * FROM known_fakes WHERE fake_text = ? OR fake_text LIKE ?`).get(candidate, `%${lines[0]}%`);
  }
  return null;
}

function clearDemoData() {
  const db = getDb();
  const deletedLogs = db.prepare(`DELETE FROM verification_logs WHERE is_demo = 1`).run().changes;
  const deletedFakes = db.prepare(`DELETE FROM known_fakes WHERE is_demo = 1`).run().changes;
  return { deletedLogs, deletedFakes };
}

function getVerificationStats() {
  return getReportStats('all');
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
  getReportStats,
  getSourceDetails,
  recordKnownFake,
  checkKnownFake,
  clearDemoData,
  getSetting,
  setSetting,
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  searchKurals
};

