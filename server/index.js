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
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  searchKurals,
  logVerification,
  getVerificationLogs,
  getVerificationStats,
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
app.use(express.json({ limit: '5mb' }));

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

// 3. Verification Endpoint (with source logging)
app.post('/api/verify', (req, res) => {
  const { text, source_ai = 'Not from AI' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Quotation text is required.' });
  }
  const result = verifyCouplet(text);
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Asynchronously log verification without delaying response
  try {
    logVerification({
      inputText: text,
      resultStatus: result.status,
      wrongWordsCount: result.wrong_words_count || 0,
      kuralNumber: result.kural?.number || null,
      sourceAi: source_ai,
      ip
    });
  } catch (e) {
    console.warn('Failed to log verification:', e.message);
  }

  res.json(result);
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

// 9. Admin Protected Endpoints (/api/admin/*)
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = getVerificationStats();
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
