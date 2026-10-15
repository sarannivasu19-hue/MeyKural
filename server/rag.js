/**
 * மெய்க்குறள் (MeyKural) Strict RAG & Chatbot Engine
 * - Deterministic retrieval for exact Kural numbers, Athikarams, and positions.
 * - Retrieval-first from SQLite database
 * - Grounded LLM generation using only authoritative records
 * - Self-verification of any quoted kurals
 * - Full offline support with canonical retrieval answers
 */
const {
  searchKurals,
  getCoupletByNumber,
  getCoupletsByChapter,
  getAllChapters,
  getSetting
} = require('./db');
const { verifyCouplet } = require('./verifier');
const { parseKuralQuery } = require('./kuralParser');
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

/**
 * Main chat handler implementing retrieval-before-generation
 */
async function handleChatQuery(message, conversationHistory = []) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const allChapters = getAllChapters();

  // Step 1: Detect intent and extract entities (numbers, athikarams, positions)
  const parsed = parseKuralQuery(message, allChapters);

  // =========================================================================
  // CASE 1: Exact Kural Number or Meaning Request
  // =========================================================================
  if (parsed.type === 'exact_kural' || parsed.type === 'kural_meaning') {
    const num = parsed.kuralNumber;

    // Range check: 1 to 1,330
    if (num < 1 || num > 1330) {
      return {
        status: 'out_of_range',
        mode: 'deterministic',
        answer: `⚠️ **வரம்பிற்கு அப்பாற்பட்ட குறள் எண் (${num}):**\n\nதிருக்குறளில் மொத்தம் **1,330 குறட்பாக்கள்** மட்டுமே உள்ளன (133 அதிகாரங்கள், அதிகாரத்திற்கு 10 குறள்கள் வீதம்).\n\nநீங்கள் கேட்ட குறள் எண் **#${num}** செல்லுபடியாகாது. தயவுசெய்து 1 முதல் 1330 வரையிலான எண்ணைக் கேட்கவும்.\n\n*(The Thirukkural contains exactly 1,330 couplets across 133 chapters. Couplet #${num} is out of range).*`,
        verifiedCards: []
      };
    }

    const k = getCoupletByNumber(num);
    if (!k) {
      return {
        status: 'not_found',
        mode: 'deterministic',
        answer: `குறள் எண் #${num} தரவுத்தளத்தில் காணப்படவில்லை.`,
        verifiedCards: []
      };
    }

    // Build authoritative response
    let answer = `### குறள் #${k.number} — ${k.chapter_name} (${k.chapter_translation})\n\n`;
    answer += `> **${k.line1}**\n> **${k.line2}**\n\n`;
    answer += `- **அதிகாரம்:** ${k.chapter_name} (அதிகாரம் #${k.chapter_number})\n`;
    answer += `- **பால்:** ${k.section_name} (${k.section_translation})\n`;
    if (k.group_name) answer += `- **இயல்:** ${k.group_name}\n`;
    answer += `\n#### 📖 உரைகள் (Meanings):\n`;
    answer += `- **மு. வரதராசனார் உரை:** ${k.meaning_mv}\n`;
    if (k.meaning_sp) answer += `- **சாலமன் பாப்பையா உரை:** ${k.meaning_sp}\n`;
    if (k.meaning_mk) answer += `- **மு. கருணாநிதி உரை:** ${k.meaning_mk}\n`;
    if (k.translation_en) {
      answer += `\n**English Translation:**\n> *"${k.translation_en}"*\n`;
    }

    const card = {
      number: k.number,
      chapter: k.chapter_name,
      translation: k.chapter_translation,
      line1: k.line1,
      line2: k.line2,
      meaning: k.meaning_mv
    };

    // If Gemini key is available and user asked for deeper meaning/explanation
    if (geminiKey && parsed.isMeaningRequest) {
      try {
        const geminiModel = process.env.GEMINI_MODEL || getSetting('gemini_model') || getSetting('chatbot_model') || config.gemini_model || 'gemini-3.5-flash-lite';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const prompt = `You are a respectful Tamil Thirukkural scholar.
AUTHORITATIVE KURAL RECORD:
Kural #${k.number}: "${k.line1} / ${k.line2}"
Chapter: ${k.chapter_name} (${k.chapter_translation})
Section: ${k.section_name}
Meaning: ${k.meaning_mv}
English: ${k.translation_en}

User Question: "${message}"

Task: Provide a brief, beautiful scholarly explanation of this exact couplet in Tamil and English based on the record above. Do not alter the couplet words.`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
          const gData = await res.json();
          const extra = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (extra) {
            answer += `\n---\n#### 💡 திருவள்ளுவர் சிந்தனை விளக்கம்:\n${extra.trim()}`;
          }
        }
      } catch {}
    }

    return {
      status: 'online',
      mode: 'deterministic_canonical',
      answer,
      verifiedCards: [card]
    };
  }

  // =========================================================================
  // CASE 2: Specific Kural within an Athikaram
  // Examples: "கல்வி அதிகாரத்தில் 5வது குறள் என்ன?", "Show the third Kural in Kalvi athikaram"
  // =========================================================================
  if (parsed.type === 'kural_in_athikaram') {
    const k = getCoupletByNumber(parsed.kuralNumber);
    if (!k) {
      return {
        status: 'not_found',
        mode: 'deterministic',
        answer: `அதிகாரம் ${parsed.chapter.name}-ல் குறள் எண் ${parsed.position} காணப்படவில்லை.`,
        verifiedCards: []
      };
    }

    let answer = `### அதிகாரம் ${parsed.chapter.name} — ${parsed.position}-வது குறள் (குறள் #${k.number})\n\n`;
    answer += `> **${k.line1}**\n> **${k.line2}**\n\n`;
    answer += `- **அதிகாரம்:** ${k.chapter_name} (அதிகாரம் #${k.chapter_number}) • ${k.chapter_translation}\n`;
    answer += `- **பால்:** ${k.section_name} (${k.section_translation})\n\n`;
    answer += `#### 📖 உரை:\n- **மு. வரதராசனார் உரை:** ${k.meaning_mv}\n`;
    if (k.meaning_sp) answer += `- **சாலமன் பாப்பையா உரை:** ${k.meaning_sp}\n`;
    if (k.translation_en) answer += `\n**English:** *"${k.translation_en}"*\n`;

    const card = {
      number: k.number,
      chapter: k.chapter_name,
      translation: k.chapter_translation,
      line1: k.line1,
      line2: k.line2,
      meaning: k.meaning_mv
    };

    return {
      status: 'online',
      mode: 'deterministic_canonical',
      answer,
      verifiedCards: [card]
    };
  }

  // =========================================================================
  // CASE 3: Athikaram Number
  // Examples: "10வது அதிகாரத்தைச் சொல்லு", "அதிகாரம் 10-ல் உள்ள குறள்கள் என்ன?", "Show all Kurals in Athikaram 10"
  // =========================================================================
  if (parsed.type === 'athikaram_number') {
    const athNum = parsed.athikaramNumber;

    if (athNum < 1 || athNum > 133) {
      return {
        status: 'out_of_range',
        mode: 'deterministic',
        answer: `⚠️ **வரம்பிற்கு அப்பாற்பட்ட அதிகாரம் (${athNum}):**\n\nதிருக்குறளில் மொத்தம் **133 அதிகாரங்கள்** மட்டுமே உள்ளன (ஒவ்வொரு அதிகாரத்திலும் 10 குறள்கள் வீதம் 1,330 குறள்கள்).\n\nநீங்கள் கேட்ட அதிகாரம் எண் **#${athNum}** இல்லை. தயவுசெய்து 1 முதல் 133 வரையிலான அதிகாரத்தைக் கேட்கவும்.\n\n*(The Thirukkural contains exactly 133 chapters. Chapter #${athNum} is out of range).*`,
        verifiedCards: []
      };
    }

    const kurals = getCoupletsByChapter(athNum);
    const chapter = allChapters.find((c) => c.number === athNum) || {
      name: kurals[0]?.chapter_name || `அதிகாரம் ${athNum}`,
      translation: kurals[0]?.chapter_translation || '',
      section_name: 'பொருட்பால்',
      section_translation: 'Wealth'
    };

    let answer = `### அதிகாரம் #${athNum}: ${chapter.name} (${chapter.translation})\n`;
    answer += `**பால்:** ${chapter.section_name} (${chapter.section_translation}) • **குறள்கள்:** ${chapter.start_kural || (athNum - 1) * 10 + 1} முதல் ${chapter.end_kural || athNum * 10} வரை\n\n`;
    answer += `இந்த அதிகாரத்தில் உள்ள 10 அதிகாரபூர்வக் குறட்பாக்கள்:\n\n`;

    const cards = [];
    kurals.forEach((k, idx) => {
      answer += `**${idx + 1}. குறள் #${k.number}:**\n> ${k.line1}\n> ${k.line2}\n*பொருள்:* ${k.meaning_mv}\n\n`;
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
      status: 'online',
      mode: 'deterministic_canonical',
      answer,
      verifiedCards: cards
    };
  }

  // =========================================================================
  // CASE 4: Athikaram by Name
  // Examples: "கல்வி அதிகாரத்தை விளக்கு", "கல்வி அதிகாரத்தில் உள்ள குறள்கள் என்ன?", "Explain the Kalvi Athikaram"
  // =========================================================================
  if (parsed.type === 'athikaram_name') {
    const ch = parsed.chapter;
    const kurals = getCoupletsByChapter(ch.number);

    let answer = `### அதிகாரம் #${ch.number}: ${ch.name} (${ch.translation})\n`;
    answer += `**பால்:** ${ch.section_name} (${ch.section_translation}) • **குறள்கள்:** ${ch.start_kural} முதல் ${ch.end_kural} வரை\n\n`;
    answer += `இவ்வதிகாரத்தில் உள்ள 10 குறட்பாக்கள் மற்றும் உரைகள்:\n\n`;

    const cards = [];
    kurals.forEach((k, idx) => {
      answer += `**${idx + 1}. குறள் #${k.number}:**\n> ${k.line1}\n> ${k.line2}\n*பொருள்:* ${k.meaning_mv}\n\n`;
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
      status: 'online',
      mode: 'deterministic_canonical',
      answer,
      verifiedCards: cards
    };
  }

  // =========================================================================
  // CASE 5: General Literature Topic / Question
  // Examples: "திருக்குறளில் கல்வியின் முக்கியத்துவம் என்ன?", "வள்ளுவர் அன்பைப் பற்றி என்ன கூறுகிறார்?"
  // =========================================================================
  const cleanQuery = message.replace(/[^\u0B80-\u0BFF\w\s]/g, ' ').trim();
  let retrievedKurals = [];

  if (parsed.matchedChapter) {
    retrievedKurals = getCoupletsByChapter(parsed.matchedChapter.number).slice(0, 4);
  } else {
    retrievedKurals = searchKurals(cleanQuery, { limit: 4 });
  }

  // Offline / No API Key: Canonical retrieval response
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
    retrievedKurals.forEach((k) => {
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

  // Grounded LLM Prompt with Strict Canonical Context
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
          maxOutputTokens: 900
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
        max_tokens: 900,
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

    // Self-verification of any couplets inside the answer
    const { cleanText, verifiedCards, hallucinationsFound } = selfVerifyAnswer(rawAnswer);

    const finalCards = verifiedCards.length > 0 ? verifiedCards : retrievedKurals.slice(0, 3).map((k) => ({
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
