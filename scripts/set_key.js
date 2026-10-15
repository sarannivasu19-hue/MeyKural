/**
 * Script: set_key.js
 * Terminal helper to safely set GEMINI_API_KEY into .env with hidden input,
 * and perform an immediate validation test call without printing the secret.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE = path.join(ROOT_DIR, '.env.example');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'config.json');

function askHidden(query) {
  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    process.stdout.write(query);
    muted = true;

    rl.question('', (value) => {
      muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve((value || '').trim());
    });
  });
}

function maskKey(key) {
  if (!key) return '(empty)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

async function testGeminiKey(apiKey, modelName) {
  const model = modelName || 'gemini-3.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'வணக்கம்' }] }],
    generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      return { ok: true, model };
    }

    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || '';

    if (res.status === 400 || res.status === 403 || msg.includes('API key')) {
      return { ok: false, reason: 'தவறான API சாவி (Invalid API key).' };
    }
    if (res.status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
      return { ok: false, reason: 'API ஒதுக்கீடு அல்லது வீத வரம்பு முடிந்தது (Quota/Rate limit exceeded).' };
    }
    return { ok: false, reason: `API பிழை (${res.status}): ${msg || 'Unknown'}` };
  } catch (err) {
    return { ok: false, reason: `இணைப்புப் பிழை: ${err.message}` };
  }
}

function updateEnvFile(newKey, newModel) {
  let content = '';
  if (fs.existsSync(ENV_FILE)) {
    content = fs.readFileSync(ENV_FILE, 'utf8');
  } else if (fs.existsSync(ENV_EXAMPLE)) {
    content = fs.readFileSync(ENV_EXAMPLE, 'utf8');
  } else {
    content = 'PORT=3001\nJWT_SECRET=meikkural-secret\n';
  }

  // Update or insert GEMINI_API_KEY
  if (/^GEMINI_API_KEY=.*$/m.test(content)) {
    content = content.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${newKey}`);
  } else {
    content += `\nGEMINI_API_KEY=${newKey}\n`;
  }

  // Update or insert GEMINI_MODEL if provided
  if (newModel) {
    if (/^GEMINI_MODEL=.*$/m.test(content)) {
      content = content.replace(/^GEMINI_MODEL=.*$/m, `GEMINI_MODEL=${newModel}`);
    } else {
      content += `\nGEMINI_MODEL=${newModel}\n`;
    }
  }

  fs.writeFileSync(ENV_FILE, content, 'utf8');
}

async function promptAndSetKey(options = {}) {
  const { allowSkip = true } = options;

  console.log('\n======================================================');
  console.log('🔑 மெய்க்குறள் (MeyKural) - Google Gemini API Setup');
  console.log('======================================================');

  // Check current key
  let currentKey = '';
  let currentModel = 'gemini-3.5-flash';
  if (fs.existsSync(ENV_FILE)) {
    const envData = fs.readFileSync(ENV_FILE, 'utf8');
    const m = envData.match(/^GEMINI_API_KEY=(.*)$/m);
    if (m && m[1]) currentKey = m[1].trim().replace(/^["']|["']$/g, '');
    const mm = envData.match(/^GEMINI_MODEL=(.*)$/m);
    if (mm && mm[1]) currentModel = mm[1].trim().replace(/^["']|["']$/g, '');
  }

  if (currentKey) {
    console.log(`தற்போதுள்ள சாவி (Current Key): ${maskKey(currentKey)}`);
    console.log(`மாதிரி (Model): ${currentModel}`);
  }

  console.log('💡 உள்ளீடு செய்யும் போது எழுத்துக்கள் திரையில் தெரியாது (Input will be hidden).');
  const enteredKey = await askHidden('Enter GEMINI_API_KEY (press Enter to keep existing / skip): ');

  const keyToUse = enteredKey || currentKey;

  if (!keyToUse) {
    if (allowSkip) {
      console.log('⏩ சாவி உள்ளிடப்படவில்லை. ஆஃப்லைன் முறையில் தொடரலாம்.');
      return { skipped: true };
    }
    console.log('⚠️ சாவி உள்ளிடப்படவில்லை.');
    return { ok: false };
  }

  if (enteredKey) {
    updateEnvFile(enteredKey, currentModel);
    console.log(`✅ சாவி .env கோப்பில் சேமிக்கப்பட்டது: ${maskKey(enteredKey)}`);
  }

  console.log(`\n🔄 Testing connection to Gemini API (${currentModel})...`);
  const testRes = await testGeminiKey(keyToUse, currentModel);

  if (testRes.ok) {
    console.log('✨ [வெற்றி / SUCCESS] Gemini API இணைப்பு மிகச்சரியாக இயங்குகிறது!');
  } else {
    console.log(`⚠️ [சோதனைத் தோல்வி / Test Failed] ${testRes.reason}`);
  }

  console.log('======================================================\n');
  return testRes;
}

if (require.main === module) {
  promptAndSetKey().catch((err) => {
    console.error('Error setting key:', err.message);
    process.exit(1);
  });
}

module.exports = { promptAndSetKey, testGeminiKey, maskKey, updateEnvFile };
