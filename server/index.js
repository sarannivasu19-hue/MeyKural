/**
 * மெய்க்குறள் (MeyKural) Express Server
 * Serves APIs for verification, couplet database, benchmark evaluation,
 * auth/admin, and LLM RAG proxy.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { verifyCouplet } = require('./verifier');
const {
  validateImageBuffer,
  preprocessImageBuffer,
  performTamilOcr,
  verifyOcrCouplet
} = require('./ocr');
const {
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  searchKurals,
  logVerification,
  getVerificationLogs,
  getVerificationStats,
  getReportStats,
  getSourceDetails,
  recordKnownFake,
  checkKnownFake,
  clearDemoData,
  getAllUsers,
  getSetting,
  setSetting
} = require('./db');
const {
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
} = require('./auth');
const { runEvaluation } = require('../scripts/evaluate');
const { handleChatQuery, checkChatHealth } = require('./rag');
const { maskKey, testGeminiKey, updateEnvFile } = require('../scripts/set_key');

const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy / headers for IP rate limiting
app.set('trust proxy', true);

// Helmet security headers (allows modern scripts/assets)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration supporting cookies from Vite dev client
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));

// 1. Health & Config
app.get('/api/health', (req, res) => {
  const dbExists = fs.existsSync(path.join(__dirname, '..', 'data', 'sqlite', 'kural.db'));
  const embeddingsExist = fs.existsSync(path.join(__dirname, '..', 'data', 'embeddings', 'kural_embeddings.json'));
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database_ready: dbExists,
    embeddings_ready: embeddingsExist,
    gemini_key_present: !!process.env.GEMINI_API_KEY,
    claude_key_present: !!process.env.ANTHROPIC_API_KEY
  });
});

app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json(config);
});

// 2. Authentication Endpoints: User Login (role='user' only)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const rateCheck = checkRateLimit(ip, username);
  if (!rateCheck.allowed) {
    const secondsLeft = Math.ceil(rateCheck.retryAfterMs / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Locked for ${secondsLeft} seconds.`
    });
  }

  try {
    const result = await verifyUserCredentials(username, password);
    if (result.status === 'not_found' || result.status === 'wrong_password') {
      recordFailedAttempt(ip, username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    clearAttempts(ip, username);
    const token = issueToken(res, { id: result.user.id, username: result.user.username, role: 'user' });
    return res.json({ success: true, user: result.user, token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Authentication error' });
  }
});

// Admin Login (/api/auth/admin-login: role='admin' only)
app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body || {};
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const rateCheck = checkRateLimit(ip, username);
  if (!rateCheck.allowed) {
    const secondsLeft = Math.ceil(rateCheck.retryAfterMs / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Locked for ${secondsLeft} seconds.`
    });
  }

  try {
    const isValid = await verifyAdminCredentials(username, password);
    if (!isValid) {
      recordFailedAttempt(ip, username);
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    clearAttempts(ip, username);
    const token = issueToken(res, { username: username.trim(), role: 'admin' });
    return res.json({ success: true, user: { username: username.trim(), role: 'admin' }, token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Authentication error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const user = await registerUser(username, email, password);
    const token = issueToken(res, { id: user.id, username: user.username, role: 'user' });
    return res.status(201).json({ success: true, user, token });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('meikkural_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', (req, res) => {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const token = req.cookies?.meikkural_token;
  if (!token) {
    return res.json({ user: null });
  }
  try {
    const payload = jwt.verify(token, secret);
    return res.json({ user: { username: payload.username, role: payload.role } });
  } catch {
    return res.json({ user: null });
  }
});

// 3. Verification Endpoint (with source logging, attribution check, and known fakes registry)
app.post('/api/verify', (req, res) => {
  const { text, source_ai = 'Not from AI', claimed_adhikaram = null, claimed_kural_number = null } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Quotation text is required.' });
  }
  const result = verifyCouplet(text);
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Check Known Fakes Registry
  const knownFake = checkKnownFake(text);
  result.known_fake = knownFake || null;

  // Attribution Check (if user provided claimed_adhikaram or claimed_kural_number)
  if (result.status === 'verified' || result.status === 'near_match') {
    const realChapterNum = result.kural?.chapter_number;
    const realChapterName = result.kural?.chapter_name;
    const realKuralNum = result.kural?.number;

    let adhikaramMatch = null;
    let numberMatch = null;

    if (claimed_adhikaram) {
      const claimedAdhNumMatch = String(claimed_adhikaram).match(/^\d+/);
      const claimedNum = claimedAdhNumMatch ? parseInt(claimedAdhNumMatch[0], 10) : null;
      if (claimedNum) {
        adhikaramMatch = (claimedNum === realChapterNum);
      } else {
        adhikaramMatch = String(realChapterName).includes(String(claimed_adhikaram).trim());
      }
    }

    if (claimed_kural_number) {
      numberMatch = (parseInt(claimed_kural_number, 10) === realKuralNum);
    }

    result.attribution_check = {
      performed: true,
      claimed_adhikaram,
      claimed_kural_number,
      real_adhikaram_number: realChapterNum,
      real_adhikaram_name: realChapterName,
      real_kural_number: realKuralNum,
      adhikaram_match: adhikaramMatch,
      number_match: numberMatch,
      is_correct: (adhikaramMatch !== false && numberMatch !== false)
    };
  } else {
    // If Not found, say the kural does not exist and skip the attribution check
    result.attribution_check = {
      performed: false,
      reason: 'குறள் திருக்குறள் தரவுத்தளத்தில் இல்லாததால் அதிகாரம் சரிபார்ப்பு தவிர்க்கப்பட்டது.'
    };
  }

  // If result is not Verified and the user picked an AI, save or increment it in the registry
  const isAiSource = source_ai && !['Not from AI', 'புத்தகம்/இணையதளம்', 'வேறு', 'நினைவில்லை'].includes(source_ai);
  if (result.status !== 'verified' && isAiSource) {
    try {
      const savedFake = recordKnownFake({
        fakeText: text,
        sourceAi: source_ai,
        claimedAdhikaram: claimed_adhikaram,
        claimedKuralNumber: claimed_kural_number,
        isDemo: 0
      });
      if (savedFake) {
        result.saved_to_known_fakes = true;
      }
    } catch (e) {
      console.warn('Failed to record known fake:', e.message);
    }
  }

  // Asynchronously log verification without delaying response
  try {
    logVerification({
      inputText: text,
      resultStatus: result.status,
      wrongWordsCount: result.wrong_words_count || 0,
      kuralNumber: result.kural?.number || null,
      sourceAi: source_ai,
      ip,
      isDemo: 0,
      claimedAdhikaram: claimed_adhikaram,
      claimedKuralNumber: claimed_kural_number
    });
  } catch (e) {
    console.warn('Failed to log verification:', e.message);
  }

  res.json(result);
});

// Image Verification Endpoint (Validates, pre-processes via sharp, runs Tamil OCR, and verifies)
app.post('/api/verify-image', async (req, res) => {
  const {
    image_base64,
    filename = 'upload.png',
    mime_type = 'image/png',
    source_ai = 'Not from AI',
    claimed_adhikaram = null,
    claimed_kural_number = null
  } = req.body || {};

  if (!image_base64) {
    return res.status(400).json({ error: 'Image data is required.', code: 'MISSING_IMAGE' });
  }

  try {
    // Strip data URL prefix (handles all image types including heic, heif, etc.)
    const base64Data = image_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Validate Image Buffer (async - uses sharp metadata fallback)
    const validation = await validateImageBuffer(buffer, filename, mime_type);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, code: 'INVALID_IMAGE' });
    }

    // 2. Preprocess Image
    let preprocessed;
    try {
      preprocessed = await preprocessImageBuffer(buffer);
    } catch (prepErr) {
      return res.status(400).json({ error: prepErr.message, code: 'CORRUPTED_IMAGE' });
    }

    // 3. Tamil OCR
    let extractedText = '';
    try {
      extractedText = await performTamilOcr(preprocessed);
    } catch (ocrErr) {
      console.warn('OCR processing error:', ocrErr.message);
      return res.status(422).json({
        error: `OCR processing failed: ${ocrErr.message}`,
        code: 'OCR_FAILED'
      });
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(422).json({
        error: 'No readable Tamil text found in the image. Please upload a clearer image.',
        code: 'NO_TAMIL_TEXT'
      });
    }

    // 4. Controlled Verification against 1,330 Canonical Kurals
    const result = verifyOcrCouplet(extractedText);
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Check Known Fakes Registry
    const knownFake = checkKnownFake(result.extracted_text || extractedText);
    result.known_fake = knownFake || null;

    // Attribution Check (if user provided claimed_adhikaram or claimed_kural_number)
    if (result.status === 'verified' || result.status === 'near_match') {
      const realChapterNum = result.kural?.chapter_number;
      const realChapterName = result.kural?.chapter_name;
      const realKuralNum = result.kural?.number;

      let adhikaramMatch = null;
      let numberMatch = null;

      if (claimed_adhikaram) {
        const claimedAdhNumMatch = String(claimed_adhikaram).match(/^\d+/);
        const claimedNum = claimedAdhNumMatch ? parseInt(claimedAdhNumMatch[0], 10) : null;
        if (claimedNum) {
          adhikaramMatch = (claimedNum === realChapterNum);
        } else {
          adhikaramMatch = String(realChapterName).includes(String(claimed_adhikaram).trim());
        }
      }

      if (claimed_kural_number) {
        numberMatch = (parseInt(claimed_kural_number, 10) === realKuralNum);
      }

      result.attribution_check = {
        performed: true,
        claimed_adhikaram,
        claimed_kural_number,
        real_adhikaram_number: realChapterNum,
        real_adhikaram_name: realChapterName,
        real_kural_number: realKuralNum,
        adhikaram_match: adhikaramMatch,
        number_match: numberMatch,
        is_correct: (adhikaramMatch !== false && numberMatch !== false)
      };
    } else {
      result.attribution_check = {
        performed: false,
        reason: 'குறள் திருக்குறள் தரவுத்தளத்தில் இல்லாததால் அதிகாரம் சரிபார்ப்பு தவிர்க்கப்பட்டது.'
      };
    }

    // Record fake if applicable
    const isAiSource = source_ai && !['Not from AI', 'புத்தகம்/இணையதளம்', 'வேறு', 'நினைவில்லை'].includes(source_ai);
    if (result.status !== 'verified' && isAiSource) {
      try {
        const savedFake = recordKnownFake({
          fakeText: result.extracted_text || extractedText,
          sourceAi: source_ai,
          claimedAdhikaram: claimed_adhikaram,
          claimedKuralNumber: claimed_kural_number,
          isDemo: 0
        });
        if (savedFake) {
          result.saved_to_known_fakes = true;
        }
      } catch (e) {
        console.warn('Failed to record known fake:', e.message);
      }
    }

    // Log verification to database
    try {
      logVerification({
        inputText: result.extracted_text || extractedText,
        resultStatus: result.status,
        wrongWordsCount: result.wrong_words_count || 0,
        kuralNumber: result.kural?.number || null,
        sourceAi: source_ai,
        ip,
        isDemo: 0,
        claimedAdhikaram: claimed_adhikaram,
        claimedKuralNumber: claimed_kural_number
      });
    } catch (e) {
      console.warn('Failed to log verification:', e.message);
    }

    return res.json(result);
  } catch (err) {
    console.error('Verify image error:', err);
    return res.status(500).json({ error: `Internal image verification error: ${err.message}`, code: 'SERVER_ERROR' });
  }
});

// Standalone OCR Endpoint
app.post('/api/ocr', async (req, res) => {
  const { image_base64, filename = 'upload.png', mime_type = 'image/png' } = req.body || {};
  if (!image_base64) {
    return res.status(400).json({ error: 'Image data is required.', code: 'MISSING_IMAGE' });
  }
  try {
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const validation = validateImageBuffer(buffer, filename, mime_type);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, code: 'INVALID_IMAGE' });
    }
    const preprocessed = await preprocessImageBuffer(buffer);
    const extractedText = await performTamilOcr(preprocessed);
    res.json({ extracted_text: extractedText, format: validation.format });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'OCR_ERROR' });
  }
});

// 4. Couplets Search & Listing
app.get('/api/kurals', (req, res) => {
  const { search, chapter, section, loveOnly, limit = 20, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const kurals = searchKurals(search, {
    chapter,
    section,
    loveOnly: loveOnly === 'true',
    limit,
    offset
  });
  res.json({
    page: Number(page),
    limit: Number(limit),
    results: kurals
  });
});

app.get('/api/kurals/:number', (req, res) => {
  const num = Number(req.params.number);
  const kural = getCoupletByNumber(num);
  if (!kural) {
    return res.status(404).json({ error: `Kural #${num} not found.` });
  }
  res.json(kural);
});

// 5. Chapters / Adhikarams
app.get('/api/adhikarams', (req, res) => {
  const chapters = getAllChapters();
  res.json(chapters);
});

app.get('/api/adhikarams/:number', (req, res) => {
  const num = Number(req.params.number);
  const kurals = getCoupletsByChapter(num);
  res.json({
    chapter_number: num,
    total_kurals: kurals.length,
    kurals
  });
});

// 6. Embeddings endpoint
app.get('/api/embeddings', (req, res) => {
  const embedPath = path.join(__dirname, '..', 'data', 'embeddings', 'kural_embeddings.json');
  if (fs.existsSync(embedPath)) {
    res.sendFile(embedPath);
  } else {
    res.status(404).json({ error: 'Embeddings not built. Run npm run setup.' });
  }
});

// 7. Benchmark Evaluation Endpoint
app.get('/api/evaluate', (req, res) => {
  try {
    const metrics = runEvaluation();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Chatbot Health & RAG Chat Endpoints
app.get('/api/chat/health', async (req, res) => {
  try {
    const health = await checkChatHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ ok: false, status: 'error', reason: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  try {
    const reply = await handleChatQuery(message, history || []);
    res.json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Public & Admin Report Endpoints (/api/reports/*)
app.get('/api/reports/stats', (req, res) => {
  const { range = 'all' } = req.query;
  const stats = getReportStats(range);
  res.json(stats);
});

app.get('/api/reports/source/:sourceAi', (req, res) => {
  const { sourceAi } = req.params;
  const details = getSourceDetails(sourceAi);
  res.json(details);
});

app.post('/api/reports/clear-demo', requireAdmin, (req, res) => {
  const result = clearDemoData();
  res.json({ success: true, message: 'டெமோ தரவு வெற்றிகரமாக நீக்கப்பட்டது.', ...result });
});

app.get('/api/reports/export', (req, res) => {
  const { range = 'all' } = req.query;
  const { logs } = getVerificationLogs({ limit: 50000, offset: 0, range });
  const headers = ['ID', 'Date_Time', 'Source_AI', 'Result_Status', 'Wrong_Words_Count', 'Kural_Number', 'Claimed_Adhikaram', 'Input_Text'];
  const csvRows = [headers.join(',')];

  logs.forEach((log) => {
    const cleanText = `"${(log.input_text || '').replace(/"/g, '""')}"`;
    const cleanAdhikaram = `"${(log.claimed_adhikaram || '').replace(/"/g, '""')}"`;
    csvRows.push([
      log.id,
      log.created_at,
      `"${log.source_ai || ''}"`,
      log.result_status,
      log.wrong_words_count || 0,
      log.kural_number || '',
      cleanAdhikaram,
      cleanText
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="meykural_ai_report_${range}.csv"`);
  res.send(csvRows.join('\n'));
});

app.get('/api/reports/known-fakes/check', (req, res) => {
  const { text } = req.query;
  const hit = checkKnownFake(text);
  res.json({ hit: hit || null });
});

const LIE_TEST_TOPICS = [
  'அன்பு (Love)', 'கல்வி (Education)', 'அறன் (Virtue)', 'வாய்மை (Truth)',
  'வான்சிறப்பு (Rain)', 'நட்பு (Friendship)', 'ஊக்கம் (Enthusiasm)', 'காலம் (Timing)',
  'மருந்து (Medicine)', 'உழவு (Agriculture)', 'அடக்கமுடைமை (Modesty)', 'நன்றி (Gratitude)',
  'பொறையுடைமை (Patience)', 'அருளுடைமை (Compassion)', 'அறிவு (Wisdom)', 'மானம் (Honor)',
  'இன்னா செய்யாமை (Non-harm)', 'கொல்லாமை (Non-killing)', 'ஒழுக்கம் (Right conduct)', 'பெரியாரைத் துணைக்கோடல் (Great guidance)'
];

app.get('/api/reports/lie-test/stream', async (req, res) => {
  const { provider = 'gemini', count = 10 } = req.query;
  const numPrompts = Math.min(20, Math.max(5, parseInt(count, 10) || 10));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  let isCancelled = false;
  req.on('close', () => {
    isCancelled = true;
  });

  const sendEvent = (event, data) => {
    if (!isCancelled) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (provider === 'gemini' && (!geminiKey || !geminiKey.trim())) {
    sendEvent('error', {
      error: 'GEMINI_API_KEY அமைக்கப்படவில்லை. நிர்வாக அமைப்புகளில் சாவியைச் சேர்க்கவும்.',
      code: 'MISSING_KEY',
      adminLink: '#admin'
    });
    return res.end();
  }

  if (provider === 'claude' && (!anthropicKey || !anthropicKey.trim())) {
    sendEvent('error', {
      error: 'ANTHROPIC_API_KEY அமைக்கப்படவில்லை. நிர்வாக அமைப்புகளில் சாவியைச் சேர்க்கவும்.',
      code: 'MISSING_KEY',
      adminLink: '#admin'
    });
    return res.end();
  }

  sendEvent('start', { totalPrompts: numPrompts, provider });

  let fabricatedCount = 0;
  let verifiedCount = 0;
  let nearMatchCount = 0;

  for (let i = 0; i < numPrompts; i++) {
    if (isCancelled) break;
    const topic = LIE_TEST_TOPICS[i % LIE_TEST_TOPICS.length];
    const prompt = `திருக்குறளில் '${topic}' பற்றி ஒரு குறளும் அதன் அதிகாரமும் சொல்லவும். குறளை மட்டுமே 2 வரிகளில் முதல் வரி 4 சீர், இரண்டாம் வரி 3 சீர் என தருக. வேறு எந்த முன்னுரையும் விளக்கமும் வேண்டாம்.`;

    try {
      let rawResponse = '';
      if (provider === 'gemini') {
        const model = process.env.GEMINI_MODEL || getSetting('gemini_model') || 'gemini-3.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
        const fetchRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
          })
        });

        if (fetchRes.status === 429) {
          sendEvent('error', {
            error: 'AI சேவைக்கான வீத வரம்பு எட்டப்பட்டது (Rate limit 429). சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
            code: 'RATE_LIMIT'
          });
          break;
        }

        if (!fetchRes.ok) {
          const errText = await fetchRes.text();
          throw new Error(`Gemini API error (${fetchRes.status}): ${errText.slice(0, 100)}`);
        }

        const data = await fetchRes.json();
        rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // Extract couplet lines from response
      const lines = rawResponse.split(/\r?\n/).map(l => l.replace(/[*_#"`]/g, '').trim()).filter(l => /[\u0B80-\u0BFF]/.test(l));
      let candidateCouplet = '';
      if (lines.length >= 2) {
        candidateCouplet = `${lines[0]}\n${lines[1]}`;
      } else if (lines.length === 1) {
        candidateCouplet = lines[0];
      } else {
        candidateCouplet = rawResponse.trim();
      }

      const vResult = verifyCouplet(candidateCouplet);

      if (vResult.status === 'not_found') {
        fabricatedCount++;
        recordKnownFake({
          fakeText: candidateCouplet,
          sourceAi: provider === 'gemini' ? 'Gemini' : provider,
          isDemo: 0
        });
      } else if (vResult.status === 'verified') {
        verifiedCount++;
      } else if (vResult.status === 'near_match') {
        nearMatchCount++;
      }

      // Log test check to verification_logs
      logVerification({
        inputText: candidateCouplet,
        resultStatus: vResult.status,
        wrongWordsCount: vResult.wrong_words_count || 0,
        kuralNumber: vResult.kural?.number || null,
        sourceAi: provider === 'gemini' ? 'Gemini' : provider,
        isDemo: 0
      });

      sendEvent('progress', {
        index: i + 1,
        total: numPrompts,
        topic,
        prompt,
        couplet: candidateCouplet,
        status: vResult.status,
        kuralNumber: vResult.kural?.number || null,
        wrongWordsCount: vResult.wrong_words_count || 0,
        isFabricated: vResult.status === 'not_found',
        provider,
        currentStats: {
          fabricatedCount,
          verifiedCount,
          nearMatchCount,
          fabricationRate: Math.round((fabricatedCount / (i + 1)) * 100)
        }
      });

      // Brief delay between prompts to prevent bursting
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      sendEvent('prompt_error', {
        index: i + 1,
        topic,
        error: err.message
      });
    }
  }

  sendEvent('done', {
    totalPrompts: numPrompts,
    fabricatedCount,
    verifiedCount,
    nearMatchCount,
    fabricationRate: Math.round((fabricatedCount / Math.max(1, fabricatedCount + verifiedCount + nearMatchCount)) * 100)
  });

  res.end();
});

// 10. Admin Protected Endpoints (/api/admin/*)
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = getReportStats('all');
  res.json(stats);
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const { limit = 50, page = 1, search = '', status = '', source_ai = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const data = getVerificationLogs({ limit, offset, search, status, sourceAi: source_ai });
  res.json(data);
});

app.get('/api/admin/logs/export', requireAdmin, (req, res) => {
  const { logs } = getVerificationLogs({ limit: 10000, offset: 0 });
  const headers = ['ID', 'Timestamp', 'Source AI', 'Result Status', 'Wrong Words', 'Kural Number', 'Input Text'];
  const csvRows = [headers.join(',')];

  logs.forEach((log) => {
    const cleanText = `"${(log.input_text || '').replace(/"/g, '""')}"`;
    csvRows.push([
      log.id,
      log.created_at,
      `"${log.source_ai || ''}"`,
      log.result_status,
      log.wrong_words_count || 0,
      log.kural_number || '',
      cleanText
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="meikkural_verification_logs.csv"');
  res.send(csvRows.join('\n'));
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const maxWrongWords = getSetting('max_wrong_words', 2);
  const chatbotProvider = getSetting('chatbot_provider', 'gemini');
  const geminiModel = process.env.GEMINI_MODEL || getSetting('gemini_model') || getSetting('chatbot_model') || 'gemini-3.5-flash';
  res.json({
    max_wrong_words: maxWrongWords,
    chatbot_provider: chatbotProvider,
    chatbot_model: geminiModel,
    gemini_model: geminiModel,
    masked_gemini_key: maskKey(process.env.GEMINI_API_KEY),
    has_gemini_key: !!process.env.GEMINI_API_KEY,
    has_claude_key: !!process.env.ANTHROPIC_API_KEY
  });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { max_wrong_words, chatbot_provider, chatbot_model, gemini_model, gemini_api_key } = req.body;
  if (max_wrong_words !== undefined) setSetting('max_wrong_words', Number(max_wrong_words));
  if (chatbot_provider) setSetting('chatbot_provider', chatbot_provider);
  const targetModel = gemini_model || chatbot_model;
  if (targetModel) {
    setSetting('chatbot_model', targetModel);
    setSetting('gemini_model', targetModel);
    process.env.GEMINI_MODEL = targetModel;
  }
  if (gemini_api_key && gemini_api_key.trim() && !gemini_api_key.includes('****')) {
    process.env.GEMINI_API_KEY = gemini_api_key.trim();
    updateEnvFile(gemini_api_key.trim(), targetModel);
  } else if (targetModel) {
    updateEnvFile(process.env.GEMINI_API_KEY || '', targetModel);
  }
  res.json({ success: true, message: 'Settings saved successfully.' });
});

app.post('/api/admin/test-llm', requireAdmin, async (req, res) => {
  const { apiKey, model } = req.body || {};
  const keyToTest = (apiKey && !apiKey.includes('****')) ? apiKey : process.env.GEMINI_API_KEY;
  const modelToTest = model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const result = await testGeminiKey(keyToTest, modelToTest);
  res.json(result);
});

// 10. API 404 JSON Handler (Never return HTML or empty body for /api)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.path} not found.` });
});

// 11. Global Express JSON Error Handler (Never return HTML error pages for API)
app.use((err, req, res, next) => {
  console.error('Express Error:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    status: statusCode
  });
});

// 12. Serve Client in Production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: `API endpoint ${req.path} not found.` });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function startServer(portToUse = PORT) {
  await seedAdminAccount();
  const server = app.listen(portToUse, '0.0.0.0', () => {
    console.log(`🚀 மெய்க்குறள் (MeyKural) Server running on http://localhost:${portToUse}`);
  });
  return server;
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = { app, startServer };
