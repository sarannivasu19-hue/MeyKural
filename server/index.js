/**
 * MeyKural Express Server
 * Serves APIs for verification, couplet database, benchmark evaluation,
 * and LLM RAG proxy.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { verifyCouplet } = require('./verifier');
const { getCoupletByNumber, getCoupletsByChapter, getAllChapters, searchKurals } = require('./db');
const { runEvaluation } = require('../scripts/evaluate');
const { handleChatQuery } = require('./rag');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

// 2. Verification Endpoint
app.post('/api/verify', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Quotation text is required.' });
  }
  const result = verifyCouplet(text);
  res.json(result);
});

// 3. Couplets Search & Listing
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

// 4. Chapters / Adhikarams
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

// 5. Embeddings endpoint
app.get('/api/embeddings', (req, res) => {
  const embedPath = path.join(__dirname, '..', 'data', 'embeddings', 'kural_embeddings.json');
  if (fs.existsSync(embedPath)) {
    res.sendFile(embedPath);
  } else {
    res.status(404).json({ error: 'Embeddings not built. Run npm run setup.' });
  }
});

// 6. Benchmark Evaluation Endpoint
app.get('/api/evaluate', (req, res) => {
  try {
    const metrics = runEvaluation();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Strict RAG Chat Endpoint
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

// 8. Serve Client in Production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

function startServer(portToUse = PORT) {
  const server = app.listen(portToUse, '0.0.0.0', () => {
    console.log(`🚀 MeyKural Server running on http://localhost:${portToUse}`);
  });
  return server;
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = { app, startServer };
