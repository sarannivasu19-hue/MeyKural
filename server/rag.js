/**
 * மெய்க்குறள் (MeyKural) Strict RAG & Chatbot Engine
 * - Retrieval-first from SQLite database
 * - System prompt strictly forbids inventing or guessing kurals
 * - Self-verification of any quoted kurals
 * - Offline/No-key fallback with canonical retrieval answers
 */
const { searchKurals, getCoupletByNumber, getSetting } = require('./db');
const { verifyCouplet } = require('./verifier');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

/**
 * Self-verifies any couplet quotes in text.
 * Verified: extracts card info.
 * Not Found: flags or masks with "This kural is not in the Tirukkural".
 */
function selfVerifyAnswer(answerText) {
  if (!answerText) return { cleanText: '', verifiedCards: [], hallucinationsFound: false };

  const lines = answerText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verifiedCards = [];
  let cleanText = answerText;
  let hallucinationsFound = false;

  // Search for 2-line Tamil patterns or quoted blocks
  for (let i = 0; i < lines.length - 1; i++) {
    const rawLine1 = lines[i];
    const rawLine2 = lines[i + 1];
    const cleanLine1 = rawLine1.replace(/^>\s*/, '').replace(/[*_#"`]/g, '').trim();
    const cleanLine2 = rawLine2.replace(/^>\s*/, '').replace(/[*_#"`]/g, '').trim();
    const candidateToVerify = `${cleanLine1}\n${cleanLine2}`;

    // Check if looks like a kural (Tamil characters and 6-8 words)
    const words = candidateToVerify.split(/\s+/).filter(Boolean);
    if (words.length >= 6 && words.length <= 8 && /[\u0B80-\u0BFF]/.test(candidateToVerify)) {
      const v = verifyCouplet(candidateToVerify);
      if (v.status === 'verified') {
        verifiedCards.push({
          number: v.kural.number,
          chapter: v.kural.chapter_name,
          translation: v.kural.chapter_translation,
          line1: v.kural.line1,
          line2: v.kural.line2,
          meaning: v.kural.meaning_mv
        });
      } else if (v.status === 'not_found') {
        hallucinationsFound = true;
        // Replace fabricated quote with notice
        const candidateRaw = `${rawLine1}\n${rawLine2}`;
        cleanText = cleanText.replace(
          candidateRaw,
          `\n> ⚠️ *[இந்த குறள் திருக்குறளில் இல்லை - AI உருவாக்கிய போலி / This kural is not in the Tirukkural]*\n`
        );
      }
    }
  }

  return { cleanText, verifiedCards, hallucinationsFound };
}

async function handleChatQuery(message, conversationHistory = []) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  const provider = getSetting('chatbot_provider', process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'claude' : 'offline');
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // 1. Retrieval First: Query canonical SQLite database
  const cleanQuery = message.replace(/[^\u0B80-\u0BFF\w\s]/g, ' ').trim();
  const retrievedKurals = searchKurals(cleanQuery, { limit: 3 });

  // 2. Offline / No API Key: Retrieval-only answer with friendly notice
  if (!geminiKey && !anthropicKey) {
    if (retrievedKurals.length === 0) {
      return {
        status: 'offline_retrieval',
        mode: 'retrieval_only',
        answer: `வணக்கம்! தற்போது AI சாவி இணைக்கப்படவில்லை (ஆஃப்லைன் முறை).\n\nஉங்கள் கேள்விக்கு நேரடிப் பொருத்தம் உள்ள குறள்கள் காணப்படவில்லை. நூலகப் பிரிவில் 1,330 குறள்களையும் அதிகாரம் வாரியாகத் தேடலாம்.`,
        verifiedCards: []
      };
    }

    let offlineAnswer = `💡 **ஆஃப்லைன் தரவுத்தளத் தேடல் முடிவுகள் (Offline Retrieval):**\n\n*(AI API சாவி இல்லாததால், உங்கள் கேள்விக்குரிய உண்மையான குறள்கள் மற்றும் உரைகள் நேரடியாக உள்ளூர் தரவுத்தளத்திலிருந்து வழங்கப்படுகின்றன)*\n\n`;

    const cards = [];
    retrievedKurals.forEach((k, idx) => {
      offlineAnswer += `### குறள் #${k.number} — ${k.chapter_name} (${k.chapter_translation})\n`;
      offlineAnswer += `> **${k.line1}**\n> **${k.line2}**\n\n`;
      offlineAnswer += `- **மு. வரதராசனார் உரை:** ${k.meaning_mv}\n`;
      offlineAnswer += `- **சாலமன் பாப்பையா உரை:** ${k.meaning_sp}\n`;
      offlineAnswer += `- **English:** ${k.translation_en}\n\n---\n\n`;

      cards.push({
        number: k.number,
        chapter: k.chapter_name,
        translation: k.chapter_translation,
        line1: k.line1,
        line2: k.line2,
        meaning: k.meaning_mv
      });
    });

    return {
      status: 'offline_retrieval',
      mode: 'retrieval_only',
      answer: offlineAnswer,
      verifiedCards: cards
    };
  }

  // 3. LLM with Strict System Prompt
  let contextPrompt = 'உண்மையான திருக்குறள் தரவுத்தளத்திலிருந்து பெறப்பட்ட பகுதிகள் (Strict Canonical Context):\n';
  retrievedKurals.forEach((k) => {
    contextPrompt += `[குறள் #${k.number} - அதிகாரம்: ${k.chapter_name}]\n"${k.line1} / ${k.line2}"\nபொருள்: ${k.meaning_mv}\nஆங்கிலம்: ${k.translation_en}\n\n`;
  });

  const systemPrompt = `You are "மெய்க்குறள் உதவியாளர்" (MeyKural Assistant), an authoritative Tamil scholar assistant for Tirukkural.
CRITICAL MANDATES:
1. NEVER invent, hallucinate, alter, or guess any couplet. The Tirukkural has exactly 1,330 couplets.
2. Only quote kurals that exist in the canonical context provided below or cite exact canonical kural numbers.
3. If the user asks about a topic, explain using the retrieved authentic kurals and their official meanings from the dataset.
4. If a user asks whether a fake quote is real, clearly state: "இந்த குறள் திருக்குறளில் இல்லை" (This couplet does not exist in the 1,330 Tirukkural couplets).
5. Never invent meanings for non-existent kurals. Answer in respectful Tamil (and English translation where helpful).`;

  try {
    let rawAnswer = '';

    if (geminiKey) {
      const geminiModel = process.env.GEMINI_MODEL || getSetting('gemini_model') || getSetting('chatbot_model') || config.gemini_model || 'gemini-3.5-flash-lite';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${contextPrompt}\n\nபயனர் கேள்வி: ${message}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error (${res.status}): ${errJson?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      rawAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (anthropicKey) {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const payload = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: `${contextPrompt}\n\nபயனர் கேள்வி: ${message}` }]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status}`);
      }

      const data = await res.json();
      rawAnswer = data.content?.[0]?.text || '';
    }

    // 4. Self-verification of any couplets inside the answer
    const { cleanText, verifiedCards, hallucinationsFound } = selfVerifyAnswer(rawAnswer);

    // Merge retrieved cards if verifiedCards is empty
    const finalCards = verifiedCards.length > 0 ? verifiedCards : retrievedKurals.slice(0, 2).map((k) => ({
      number: k.number,
      chapter: k.chapter_name,
      translation: k.chapter_translation,
      line1: k.line1,
      line2: k.line2,
      meaning: k.meaning_mv
    }));

    return {
      status: 'online',
      mode: 'llm_with_rag',
      answer: cleanText,
      verifiedCards: finalCards,
      hallucinationsDetected: hallucinationsFound
    };
  } catch (err) {
    console.error('LLM proxy failed, falling back to local retrieval:', err.message);
    // Fallback to retrieval
    let fallbackText = `⚠️ **AI சேவை இணைப்பு பிழை (${err.message}). உள்ளூர் தரவுத்தள முடிவுகள்:**\n\n`;
    retrievedKurals.forEach((k) => {
      fallbackText += `**குறள் #${k.number} (${k.chapter_name}):**\n${k.line1}\n${k.line2}\n*பொருள்:* ${k.meaning_mv}\n\n`;
    });
    return {
      status: 'fallback',
      mode: 'retrieval_only',
      answer: fallbackText,
      verifiedCards: retrievedKurals.map((k) => ({
        number: k.number,
        chapter: k.chapter_name,
        translation: k.chapter_translation,
        line1: k.line1,
        line2: k.line2,
        meaning: k.meaning_mv
      }))
    };
  }
}

async function checkChatHealth() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const model = process.env.GEMINI_MODEL || getSetting('gemini_model') || getSetting('chatbot_model') || config.gemini_model || 'gemini-3.5-flash-lite';

  if (!geminiKey || !geminiKey.trim()) {
    return {
      ok: false,
      status: 'missing_key',
      reason: 'GEMINI_API_KEY அமைக்கப்படவில்லை (Missing API key). ஆஃப்லைன் பயன்முறை மட்டுமே இயங்கும்.'
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'வணக்கம்' }] }],
    generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      return {
        ok: true,
        status: 'healthy',
        provider: 'gemini',
        model,
        message: 'Google Gemini API வெற்றிகரமாக இணைக்கப்பட்டுள்ளது (Connection OK).'
      };
    }

    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || '';

    if (res.status === 400 || res.status === 403 || msg.includes('API key') || msg.includes('API_KEY_INVALID')) {
      return {
        ok: false,
        status: 'invalid_key',
        reason: 'வழங்கப்பட்ட Gemini API சாவி தவறானது அல்லது காலாவதியானது (Invalid API key).'
      };
    }
    if (res.status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
      return {
        ok: false,
        status: 'quota_exceeded',
        reason: 'Gemini API ஒதுக்கீடு அல்லது வீத வரம்பு முடிந்தது (Quota or rate limit reached).'
      };
    }
    return {
      ok: false,
      status: 'api_error',
      reason: `Google Gemini API பிழை (${res.status}): ${msg || 'Unknown'}`
    };
  } catch (err) {
    return {
      ok: false,
      status: 'network_error',
      reason: `இணைய இணைப்பு பிழை: Google சேவையகத்தை அணுக முடியவில்லை (${err.message})`
    };
  }
}

module.exports = {
  handleChatQuery,
  selfVerifyAnswer,
  checkChatHealth
};
