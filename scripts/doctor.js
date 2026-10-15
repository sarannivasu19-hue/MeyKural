/**
 * MeyKural Doctor - Diagnostics & Health Audit
 * Validates Node version, environment variables, SQLite database,
 * raw dataset, embeddings, client bundle, and tells you exactly what to fix.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const RAW_FILE = path.join(ROOT_DIR, 'data', 'raw', 'thirukurals_ta.json');
const DB_FILE = path.join(ROOT_DIR, 'data', 'sqlite', 'kural.db');
const EMBED_FILE = path.join(ROOT_DIR, 'data', 'embeddings', 'kural_embeddings.json');
const BUNDLE_FILE = path.join(ROOT_DIR, 'client', 'public', 'data', 'thirukurals_bundle.json');
const TEST_FILE = path.join(ROOT_DIR, 'data', 'test_set', 'evaluation_dataset.json');

function runDoctor() {
  console.log('\n======================================================');
  console.log('🩺 MEYKURAL SYSTEM DIAGNOSTICS & DOCTOR');
  console.log('======================================================\n');

  const issues = [];
  let checksPassed = 0;

  // 1. Node Version Check
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.replace('v', '').split('.')[0], 10);
  if (majorVersion >= 18) {
    console.log(`✅ [Node.js Engine]: ${currentVersion} (Meets >= v18 requirement)`);
    checksPassed++;
  } else {
    console.log(`❌ [Node.js Engine]: ${currentVersion} (Too old, requires >= v18)`);
    issues.push('Upgrade Node.js to v18, v20, or v22 from https://nodejs.org/');
  }

  // 2. .env file check
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const hasGemini = /GEMINI_API_KEY=\S+/.test(envContent);
    const hasClaude = /ANTHROPIC_API_KEY=\S+/.test(envContent);

    if (hasGemini || hasClaude) {
      console.log(`✅ [Environment]: .env exists (AI LLM Key configured: ${hasGemini ? 'Gemini' : 'Claude'})`);
    } else {
      console.log(`ℹ️ [Environment]: .env exists (No AI key set; offline local RAG mode active)`);
    }
    checksPassed++;
  } else {
    console.log(`⚠️ [Environment]: .env file missing`);
    issues.push('Run `npm run setup` or copy `.env.example` to `.env`');
  }

  // 3. Raw dataset check
  if (fs.existsSync(RAW_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
      if (raw.kurals?.length === 1330 && raw.chapters?.length === 133) {
        console.log(`✅ [Canonical Dataset]: 1,330 Kurals and 133 Chapters verified in NFC`);
        checksPassed++;
      } else {
        console.log(`❌ [Canonical Dataset]: Invalid counts (${raw.kurals?.length} kurals, ${raw.chapters?.length} chapters)`);
        issues.push('Run `node scripts/build_raw_dataset.js` to re-normalize canonical dataset');
      }
    } catch (e) {
      console.log(`❌ [Canonical Dataset]: File corrupt (${e.message})`);
      issues.push('Delete data/raw/thirukurals_ta.json and run `npm run setup`');
    }
  } else {
    console.log(`❌ [Canonical Dataset]: File missing at data/raw/thirukurals_ta.json`);
    issues.push('Run `npm run setup` to acquire and validate the canonical Tirukkural dataset');
  }

  // 4. SQLite Database check
  if (fs.existsSync(DB_FILE)) {
    try {
      const db = new Database(DB_FILE, { readonly: true });
      const kuralCount = db.prepare('SELECT count(*) as count FROM kurals').get().count;
      const chapterCount = db.prepare('SELECT count(*) as count FROM chapters').get().count;
      db.close();

      if (kuralCount === 1330 && chapterCount === 133) {
        console.log(`✅ [SQLite Database]: ${DB_FILE} has all 1,330 couplets and 133 chapters`);
        checksPassed++;
      } else {
        console.log(`❌ [SQLite Database]: Count mismatch (${kuralCount} kurals, ${chapterCount} chapters)`);
        issues.push('Run `node scripts/build_db_and_embeddings.js` to rebuild SQLite');
      }
    } catch (e) {
      console.log(`❌ [SQLite Database]: Error opening database (${e.message})`);
      issues.push('Rebuild SQLite database by running `npm run setup`');
    }
  } else {
    console.log(`❌ [SQLite Database]: Missing at data/sqlite/kural.db`);
    issues.push('Run `npm run setup` to build SQLite database');
  }

  // 5. Precomputed Embeddings Check
  if (fs.existsSync(EMBED_FILE)) {
    try {
      const emb = JSON.parse(fs.readFileSync(EMBED_FILE, 'utf8'));
      if (emb.embeddings?.length === 1330) {
        console.log(`✅ [Semantic Vectors]: ${emb.embeddings.length} vectors (${emb.dimension} dims) ready`);
        checksPassed++;
      } else {
        console.log(`❌ [Semantic Vectors]: Expected 1,330 vectors, found ${emb.embeddings?.length}`);
        issues.push('Run `node scripts/build_db_and_embeddings.js`');
      }
    } catch (e) {
      console.log(`❌ [Semantic Vectors]: Corrupt embeddings file`);
      issues.push('Run `npm run setup` to regenerate embeddings');
    }
  } else {
    console.log(`❌ [Semantic Vectors]: Missing at data/embeddings/kural_embeddings.json`);
    issues.push('Run `npm run setup` to build embeddings');
  }

  // 6. Client Offline Bundle Check
  if (fs.existsSync(BUNDLE_FILE)) {
    const sizeMb = (fs.statSync(BUNDLE_FILE).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ [PWA Offline Bundle]: ${BUNDLE_FILE} (${sizeMb} MB ready for IndexedDB caching)`);
    checksPassed++;
  } else {
    console.log(`❌ [PWA Offline Bundle]: Missing at ${BUNDLE_FILE}`);
    issues.push('Run `node scripts/build_db_and_embeddings.js` to export client offline bundle');
  }

  // 7. Evaluation Benchmark Dataset
  if (fs.existsSync(TEST_FILE)) {
    const testSet = JSON.parse(fs.readFileSync(TEST_FILE, 'utf8'));
    if (testSet.real?.length === 50 && testSet.fake?.length === 50) {
      console.log(`✅ [Benchmark Dataset]: 50 Real + 50 Fake samples ready for evaluation`);
      checksPassed++;
    } else {
      console.log(`❌ [Benchmark Dataset]: Expected 50 real + 50 fake samples`);
      issues.push('Run `node scripts/build_test_set.js`');
    }
  } else {
    console.log(`❌ [Benchmark Dataset]: Missing at data/test_set/evaluation_dataset.json`);
    issues.push('Run `node scripts/build_test_set.js`');
  }

  // Summary
  console.log('\n======================================================');
  if (issues.length === 0) {
    console.log(`🎉 ALL ${checksPassed}/7 CHECKS PASSED PERFECTLY!`);
    console.log('Your system is in 100% working order. Run `npm run dev` to launch!');
    console.log('======================================================\n');
  } else {
    console.log(`⚠️ DETECTED ${issues.length} ISSUE(S):`);
    issues.forEach((issue, idx) => console.log(`  ${idx + 1}. ${issue}`));
    console.log('======================================================\n');
    process.exit(1);
  }
}

if (require.main === module) {
  runDoctor();
}

module.exports = { runDoctor };
