/**
 * SQLite Database Access Layer for MeyKural
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'sqlite', 'kural.db');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    dbInstance.pragma('journal_mode = WAL');
  }
  return dbInstance;
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
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  searchKurals
};
