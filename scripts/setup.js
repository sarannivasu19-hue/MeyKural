/**
 * One-Command Setup Script for MeyKural
 * 1. Checks and initializes .env from .env.example (with interactive key prompt if TTY).
 * 2. Fetches/validates canonical 1,330 couplets (HuggingFace + fallback).
 * 3. Populates SQLite database & precomputes semantic embeddings.
 * 4. Generates 50 real + 50 fake evaluation benchmark dataset.
 * 5. Verifies client build readiness.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const { prepareDataset } = require('./build_raw_dataset');
const { buildDatabaseAndEmbeddings } = require('./build_db_and_embeddings');
const { buildTestSet } = require('./build_test_set');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE = path.join(ROOT_DIR, '.env.example');

function promptAsync(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function handleEnvSetup() {
  if (fs.existsSync(ENV_FILE)) {
    console.log('✅ Found existing .env file.');
    return;
  }

  console.log('⚙️ .env file not found. Initializing from .env.example...');
  let envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8');

  // Check if interactive TTY
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n--- Optional AI RAG Configuration ---');
    console.log('You can provide a Google Gemini or Anthropic API key to enable live AI explanation.');
    console.log('Press [Enter] to skip (all offline verification, library, and games will work 100%).\n');

    const geminiKey = await promptAsync(rl, 'Enter GEMINI_API_KEY (optional, press Enter to skip): ');
    let anthropicKey = '';
    if (!geminiKey.trim()) {
      anthropicKey = await promptAsync(rl, 'Enter ANTHROPIC_API_KEY (optional, press Enter to skip): ');
    }
    rl.close();

    if (geminiKey.trim()) {
      envContent = envContent.replace('GEMINI_API_KEY=', `GEMINI_API_KEY=${geminiKey.trim()}`);
      console.log('🔑 GEMINI_API_KEY configured.');
    } else if (anthropicKey.trim()) {
      envContent = envContent.replace('ANTHROPIC_API_KEY=', `ANTHROPIC_API_KEY=${anthropicKey.trim()}`);
      console.log('🔑 ANTHROPIC_API_KEY configured.');
    } else {
      console.log('ℹ️ No API key provided. Offline mode will be used for AI features.');
    }
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  console.log('✅ Created .env file securely.');
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 MEYKURAL: AUTOMATED SETUP PIPELINE');
  console.log('Tamil Hackathon 2026 - Problem P15 AI Quotation Shield');
  console.log('======================================================\n');

  try {
    // 1. Environment file setup
    await handleEnvSetup();

    // 2. Dataset fetch, validation, and report
    console.log('\n[Step 1/4] Preparing canonical Tirukkural dataset...');
    await prepareDataset();

    // 3. SQLite and Embeddings
    console.log('\n[Step 2/4] Building SQLite database and precomputed embeddings...');
    buildDatabaseAndEmbeddings();

    // 4. Test benchmark set
    console.log('\n[Step 3/4] Generating 50 Real + 50 Fake evaluation benchmark...');
    buildTestSet();

    // 5. Client dependencies check
    console.log('\n[Step 4/4] Checking client dependencies...');
    const clientNodeModules = path.join(ROOT_DIR, 'client', 'node_modules');
    if (!fs.existsSync(clientNodeModules)) {
      console.log('📦 Installing client dependencies...');
      execSync('npm --prefix client install', { stdio: 'inherit' });
    } else {
      console.log('✅ Client dependencies are present.');
    }

    console.log('\n======================================================');
    console.log('🎉 MEYKURAL SETUP SUCCESSFULLY COMPLETED!');
    console.log('======================================================');
    console.log('Next steps:');
    console.log('  • npm run dev       -> Start client & backend concurrently');
    console.log('  • npm run doctor    -> Run system and environment diagnostics');
    console.log('  • npm run evaluate  -> Run the 100-sample benchmark suite');
    console.log('  • npm test          -> Run verification engine unit tests');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Setup failed with error:', err.message);
    process.exit(1);
  }
}

main();
