/**
 * Builds SQLite database (data/sqlite/kural.db) and precomputes
 * semantic embedding vectors (data/embeddings/kural_embeddings.json).
 * Also exports client/public/data/thirukurals_bundle.json for 100% offline PWA caching.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_FILE = path.join(DATA_DIR, 'raw', 'thirukurals_ta.json');
const SQLITE_DIR = path.join(DATA_DIR, 'sqlite');
const DB_FILE = path.join(SQLITE_DIR, 'kural.db');
const EMBEDDINGS_DIR = path.join(DATA_DIR, 'embeddings');
const EMBEDDINGS_FILE = path.join(EMBEDDINGS_DIR, 'kural_embeddings.json');
const CLIENT_DATA_DIR = path.join(__dirname, '..', 'client', 'public', 'data');
const CLIENT_BUNDLE_FILE = path.join(CLIENT_DATA_DIR, 'thirukurals_bundle.json');

// Ensure directories
[SQLITE_DIR, EMBEDDINGS_DIR, CLIENT_DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function tokenizeTamil(text) {
  // Normalize NFC and remove punctuation
  return text
    .normalize('NFC')
    .replace(/[.,;!?"'’‘()\[\]{}—–\-:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function generateCharNGrams(text, n = 3) {
  const clean = text.normalize('NFC').replace(/\s+/g, '');
  const ngrams = [];
  for (let i = 0; i <= clean.length - n; i++) {
    ngrams.push(clean.substring(i, i + n));
  }
  return ngrams;
}

function buildDatabaseAndEmbeddings() {
  console.log('📖 Reading validated raw dataset...');
  if (!fs.existsSync(RAW_FILE)) {
    throw new Error(`Raw dataset not found at ${RAW_FILE}. Run build_raw_dataset.js first.`);
  }

  const dataset = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  const { kurals, chapters } = dataset;

  // 1. Build SQLite Database
  console.log(`🗄️ Initializing SQLite database at ${DB_FILE}...`);
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE); // fresh build
  }

  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE chapters (
      number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      translation TEXT,
      section_number INTEGER,
      section_name TEXT,
      section_translation TEXT,
      group_name TEXT,
      start_kural INTEGER,
      end_kural INTEGER
    );

    CREATE TABLE kurals (
      number INTEGER PRIMARY KEY,
      line1 TEXT NOT NULL,
      line2 TEXT NOT NULL,
      couplet TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      section_number INTEGER NOT NULL,
      meaning_mv TEXT,
      meaning_sp TEXT,
      meaning_mk TEXT,
      explanation_ta TEXT,
      translation_en TEXT,
      transliteration1 TEXT,
      transliteration2 TEXT,
      cleaned_tokens TEXT,
      FOREIGN KEY(chapter_number) REFERENCES chapters(number)
    );

    CREATE INDEX idx_kurals_chapter ON kurals(chapter_number);
    CREATE INDEX idx_kurals_section ON kurals(section_number);
  `);

  const insertChapter = db.prepare(`
    INSERT INTO chapters (
      number, name, translation, section_number, section_name,
      section_translation, group_name, start_kural, end_kural
    ) VALUES (
      @number, @name, @translation, @section_number, @section_name,
      @section_translation, @group_name, @start, @end
    )
  `);

  const insertKural = db.prepare(`
    INSERT INTO kurals (
      number, line1, line2, couplet, chapter_number, section_number,
      meaning_mv, meaning_sp, meaning_mk, explanation_ta,
      translation_en, transliteration1, transliteration2, cleaned_tokens
    ) VALUES (
      @number, @line1, @line2, @couplet, @chapter_number, @section_number,
      @meaning_mv, @meaning_sp, @meaning_mk, @explanation_ta,
      @translation_en, @transliteration1, @transliteration2, @cleaned_tokens
    )
  `);

  const insertManyChapters = db.transaction((rows) => {
    for (const row of rows) insertChapter.run(row);
  });

  const insertManyKurals = db.transaction((rows) => {
    for (const row of rows) {
      const tokens = tokenizeTamil(row.couplet).join(' ');
      insertKural.run({ ...row, cleaned_tokens: tokens });
    }
  });

  insertManyChapters(chapters);
  insertManyKurals(kurals);
  console.log(`✅ SQLite populated with ${chapters.length} chapters and ${kurals.length} couplets.`);

  // 2. Precompute Vocabulary and Semantic Vectors
  console.log('🧠 Building precomputed semantic vector embeddings...');
  // Build frequency table of top char 3-grams and 4-grams
  const featureDocFreq = {};
  const kuralFeaturesList = [];

  kurals.forEach((k) => {
    const text = `${k.couplet} ${k.meaning_mv || ''} ${k.translation_en || ''}`;
    const ngrams = generateCharNGrams(k.couplet, 3)
      .concat(generateCharNGrams(k.couplet, 4))
      .concat(tokenizeTamil(text).map((t) => `w:${t}`));

    const uniqueSet = new Set(ngrams);
    uniqueSet.forEach((feat) => {
      featureDocFreq[feat] = (featureDocFreq[feat] || 0) + 1;
    });
    kuralFeaturesList.push(ngrams);
  });

  // Select top 384 most informative features for compact, high-precision similarity
  const sortedFeatures = Object.keys(featureDocFreq)
    .filter((f) => featureDocFreq[f] >= 2 && featureDocFreq[f] <= 400)
    .sort((a, b) => featureDocFreq[b] - featureDocFreq[a])
    .slice(0, 384);

  const featureIndexMap = {};
  sortedFeatures.forEach((feat, idx) => {
    featureIndexMap[feat] = idx;
  });

  const dimension = sortedFeatures.length;
  console.log(`📐 Feature space dimensionality: ${dimension} dimensions.`);

  // Compute L2-normalized sparse/dense vector for each kural
  const embeddings = [];
  kurals.forEach((k, idx) => {
    const ngrams = kuralFeaturesList[idx];
    const vec = new Float32Array(dimension);

    // TF-IDF weights
    ngrams.forEach((feat) => {
      const fIdx = featureIndexMap[feat];
      if (fIdx !== undefined) {
        const idf = Math.log(1 + kurals.length / (featureDocFreq[feat] || 1));
        vec[fIdx] += idf;
      }
    });

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dimension; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) vec[i] /= norm;
    }

    // Store non-zero entries sparsely or compact array
    const sparse = [];
    for (let i = 0; i < dimension; i++) {
      if (vec[i] > 0.001) {
        sparse.push([i, Math.round(vec[i] * 1000) / 1000]);
      }
    }

    embeddings.push({
      number: k.number,
      sparse
    });
  });

  const embeddingsPayload = {
    dimension,
    features: sortedFeatures,
    total_kurals: kurals.length,
    embeddings
  };

  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddingsPayload), 'utf8');
  console.log(`💾 Precomputed embeddings saved to ${EMBEDDINGS_FILE} (${(fs.statSync(EMBEDDINGS_FILE).size / 1024).toFixed(1)} KB).`);

  // 3. Export client offline bundle (Kurals + Chapters + Embeddings + Config)
  console.log('📦 Exporting client offline bundle for PWA...');
  const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'));

  const clientBundle = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    config,
    chapters,
    kurals,
    embeddingsPayload
  };

  fs.writeFileSync(CLIENT_BUNDLE_FILE, JSON.stringify(clientBundle), 'utf8');
  console.log(`💾 Client bundle saved to ${CLIENT_BUNDLE_FILE} (${(fs.statSync(CLIENT_BUNDLE_FILE).size / 1024 / 1024).toFixed(2)} MB).`);
  console.log('🎉 Database and embeddings build complete!\n');

  db.close();
}

if (require.main === module) {
  try {
    buildDatabaseAndEmbeddings();
  } catch (err) {
    console.error('Fatal error during DB and embeddings build:', err);
    process.exit(1);
  }
}

module.exports = { buildDatabaseAndEmbeddings };
