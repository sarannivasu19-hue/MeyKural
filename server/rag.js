/**
 * Strict RAG (Retrieval-Augmented Generation) Chatbot Proxy
 * Strictly cites canonical couplets from SQLite.
 * Refuses to guess or hallucinate.
 */
const { searchKurals, getCoupletByNumber } = require('./db');
const { verifyCouplet } = require('./verifier');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

async function handleChatQuery(message, conversationHistory = []) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const trustedUrl = config.trusted_site.base_url;

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey && !anthropicKey) {
    return {
      status: 'offline_mode',
      answer: `⚠️ API Key not configured. To activate live AI retrieval, configure \`GEMINI_API_KEY\` or \`ANTHROPIC_API_KEY\` in your \`.env\` file.\n\nHowever, all offline verification, library browsing, Venba meter checking, and Kural Police games are 100% active and running locally!`,
      needs_api_key: true,
      trusted_site_url: trustedUrl,
      cites: []
    };
  }

  // 1. Retrieval: Extract candidate kurals based on user question
  let verificationContext = null;
  const lines = message.split(/\r?\n/).filter(Boolean);
  if (lines.length >= 2 || message.length > 25) {
    // Looks like a couplet quotation: verify immediately
    verificationContext = verifyCouplet(message);
  }

  // Semantic/keyword search in Tirukkural DB
  const relevantKurals = searchKurals(message.replace(/[^\u0B80-\u0BFF\w\s]/g, ' '), { limit: 4 });

  let contextSnippet = 'CANONICAL TIRUKKURAL RETRIEVAL CONTEXT:\n';
  const cites = [];

  if (verificationContext) {
    contextSnippet += `[STRICT VERIFICATION RESULT FOR QUOTE]:\n`;
    contextSnippet += `Status: ${verificationContext.status}\n`;
    contextSnippet += `Confidence: ${verificationContext.confidence_percent}%\n`;
    contextSnippet += `Seal: ${verificationContext.seal}\n`;
    if (verificationContext.status === 'verified') {
      contextSnippet += `Authentic Kural #${verificationContext.kural.number} in Chapter ${verificationContext.kural.chapter_name}:\n`;
      contextSnippet += `Line 1: ${verificationContext.kural.line1}\nLine 2: ${verificationContext.kural.line2}\nMeaning: ${verificationContext.kural.meaning_mv}\n`;
      cites.push(verificationContext.kural.number);
    } else {
      contextSnippet += `Alert: This is NOT an authentic Tirukkural. Nearest match is Kural #${verificationContext.nearest_kural?.number}. Differences: ${verificationContext.word_diff.differenceCount} words altered.\n`;
      if (verificationContext.nearest_kural) cites.push(verificationContext.nearest_kural.number);
    }
  }

  relevantKurals.forEach((k) => {
    contextSnippet += `\n[Kural #${k.number} - Adhikaram: ${k.chapter_name}]\n"${k.line1} / ${k.line2}"\nMeaning: ${k.meaning_mv}\nTranslation: ${k.translation_en}\n`;
    if (!cites.includes(k.number)) cites.push(k.number);
  });

  const systemPrompt = `You are "KuralVerify Assistant", an expert, authoritative Tamil classical literature shield for Tirukkural.
Your cardinal mandate is: NEVER FABRICATE, GUESS, OR HALLUCINATE ANY COUPLET.
1. When asked if a couplet is real: Rely strictly on the VERIFICATION RESULT provided above.
2. If it is verified, ALWAYS cite the real couplet number, chapter name, and authentic two lines.
3. If it is NOT in Tirukkural, or is altered/AI-fabricated, you MUST EXPLICITLY STATE:
   "I can't verify this quotation as authentic Tirukkural. It does not exist in the canonical 1,330 couplets."
   Mention the nearest real couplet and direct the user to verify at ${trustedUrl}.
4. Provide explanations in bilingual Tamil and English when appropriate.`;

  // 2. Call LLM (Gemini or Claude)
  try {
    if (geminiKey) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\n${contextSnippet}\n\nUSER QUESTION: ${message}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // very low temperature to prevent hallucination
          maxOutputTokens: 600
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from model.';

      return {
        status: 'online',
        provider: 'gemini',
        answer,
        cites,
        verification: verificationContext,
        trusted_site_url: trustedUrl
      };
    } else if (anthropicKey) {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const payload = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `${contextSnippet}\n\nUSER QUESTION: ${message}` }
        ]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const answer = data.content?.[0]?.text || 'No response from model.';

      return {
        status: 'online',
        provider: 'claude',
        answer,
        cites,
        verification: verificationContext,
        trusted_site_url: trustedUrl
      };
    }
  } catch (err) {
    console.error('LLM proxy request failed:', err.message);
    return {
      status: 'error',
      answer: `⚠️ Connection to AI provider failed (${err.message}). Showing local offline verification result instead:`,
      verification: verificationContext,
      cites,
      trusted_site_url: trustedUrl
    };
  }
}

module.exports = { handleChatQuery };
