/**
 * மெய்க்குறள் (MeyKural) Strict Deterministic Verification Engine
 * The only source of truth is the 1,330 canonical couplets.
 * Verification is deterministic code, NEVER an LLM or embeddings.
 *
 * Exactly 3 Outcomes:
 * 1. VERIFIED: Exact match after Unicode normalization.
 * 2. NEAR MATCH: Matches ONE real couplet except <= MAX_WRONG_WORDS (2 words).
 * 3. NOT FOUND: Anything else. Shows only: "Not found. This kural does not exist in the 1,330 Tirukkural couplets."
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const RAW_PATH = path.join(__dirname, '..', 'data', 'raw', 'thirukurals_ta.json');

let config = null;
let kuralsData = null;

function loadData() {
  if (!config) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  if (!kuralsData) {
    const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
    kuralsData = raw.kurals;
  }
}

/**
 * Normalizes Tamil string to Unicode NFC, removes punctuation and zero-width characters safely.
 * Handles Tamil punctuation, danda, double danda, typographic quotes, zero-width joiners,
 * without modifying semantic Tamil characters or pulli marks.
 */
function normalizeTamil(text) {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2028\u2029]/g, '')
    .replace(/[\u0964\u0965]/g, ' ') // Tamil/Sanskrit danda and double danda
    .replace(/[.,;!?"'’‘“”«»()\[\]{}—–\-:/\\_`~*#@^+=<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks Kural Venba meter structure (Line 1: 4 cirs, Line 2: 3 cirs).
 */
function checkVenbaMeter(rawText) {
  if (!rawText) {
    return {
      valid: false,
      line1Cirs: 0,
      line2Cirs: 0,
      totalCirs: 0,
      explanation: 'Empty verse provided.'
    };
  }

  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let line1 = '';
  let line2 = '';

  if (rawLines.length === 2) {
    line1 = rawLines[0];
    line2 = rawLines[1];
  } else if (rawLines.length === 1) {
    const words = rawLines[0].split(/\s+/).filter(Boolean);
    if (words.length >= 4) {
      line1 = words.slice(0, 4).join(' ');
      line2 = words.slice(4).join(' ');
    } else {
      line1 = rawLines[0];
    }
  } else {
    line1 = rawLines[0];
    line2 = rawLines.slice(1).join(' ');
  }

  const l1Words = line1.split(/\s+/).filter(Boolean);
  const l2Words = line2.split(/\s+/).filter(Boolean);
  const totalCirs = l1Words.length + l2Words.length;
  const valid = l1Words.length === 4 && l2Words.length === 3;

  return {
    valid,
    line1Cirs: l1Words.length,
    line2Cirs: l2Words.length,
    totalCirs,
    explanation: valid
      ? 'Strict Kural Venba meter matched (4 + 3 = 7 cirs).'
      : `Format deviation: Line 1 has ${l1Words.length}/4 cirs, Line 2 has ${l2Words.length}/3 cirs.`
  };
}

/**
 * Deterministic word diff comparison
 */
function computeWordDiff(inputWords, canonWords) {
  const diffResult = [];
  const maxWords = Math.max(inputWords.length, canonWords.length);
  let wrongCount = 0;

  for (let i = 0; i < maxWords; i++) {
    const inW = inputWords[i] || '';
    const canW = canonWords[i] || '';
    if (inW === canW) {
      diffResult.push({
        position: i + 1,
        inputWord: inW,
        canonicalWord: canW,
        status: 'match'
      });
    } else {
      wrongCount++;
      diffResult.push({
        position: i + 1,
        inputWord: inW,
        canonicalWord: canW,
        status: 'mismatch'
      });
    }
  }

  return { diffResult, wrongCount };
}

/**
 * Strict 3-way Verifier Function
 */
function verifyCouplet(inputText, options = {}) {
  loadData();
  const maxWrongWords = options.maxWrongWords || config.max_wrong_words || 2;

  if (!inputText || !inputText.trim()) {
    return {
      status: 'not_found',
      verdict: 'Not Found',
      verdict_ta: 'திருக்குறளில் இல்லை',
      message: 'Not found. This kural does not exist in the 1,330 Tirukkural couplets.',
      kural: null
    };
  }

  const cleanRaw = inputText.trim();
  const meter = checkVenbaMeter(cleanRaw);
  const normalizedInput = normalizeTamil(cleanRaw);
  const compactInput = normalizedInput.replace(/\s+/g, '');
  const inputWords = normalizedInput.split(' ').filter(Boolean);

  // 1. EXACT MATCH CHECK (VERIFIED)
  for (const k of kuralsData) {
    const kuralNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const compactKural = kuralNormalized.replace(/\s+/g, '');

    if (compactInput === compactKural) {
      const canonWords = kuralNormalized.split(' ').filter(Boolean);
      return {
        status: 'verified',
        verdict: 'Verified',
        verdict_ta: 'உண்மையான திருக்குறள்',
        seal: 'green_seal',
        trust_gauge: 'authentic',
        trusted_site_url: `https://thirukkural.gokulnath.com/?kural=${k.number}`,
        confidence_percent: 100,
        meter,
        kural: k,
        wrong_words_count: 0,
        word_diff: {
          hasDifferences: false,
          differenceCount: 0,
          diffResult: canonWords.map((w, idx) => ({
            position: idx + 1,
            inputWord: w,
            canonicalWord: w,
            status: 'match'
          }))
        },
        message: 'Verified: Exact match with canonical Tirukkural couplet.'
      };
    }
  }

  // 2. NEAR MATCH CHECK (<= maxWrongWords words wrong against ONE real couplet)
  let bestCandidate = null;
  let minWrongWords = Infinity;
  let bestDiff = null;

  for (const k of kuralsData) {
    const canonNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const canonWords = canonNormalized.split(' ').filter(Boolean);

    // Both must be valid 7-word couplets for word-substitution comparison
    const { diffResult, wrongCount } = computeWordDiff(inputWords, canonWords);

    if (wrongCount < minWrongWords) {
      minWrongWords = wrongCount;
      bestCandidate = k;
      bestDiff = diffResult;
    }
  }

  if (bestCandidate && minWrongWords > 0 && minWrongWords <= maxWrongWords) {
    const wrongItems = bestDiff.filter((d) => d.status === 'mismatch');
    return {
      status: 'near_match',
      verdict: 'Incorrect, needs correction',
      verdict_ta: 'தவறானது, திருத்தம் தேவை',
      seal: 'amber_seal',
      trust_gauge: 'suspicious',
      trusted_site_url: `https://thirukkural.gokulnath.com/?kural=${bestCandidate.number}`,
      wrong_words_count: minWrongWords,
      wrong_words: wrongItems,
      message: `Only ${minWrongWords} word(s) are wrong`,
      message_ta: `${minWrongWords} சொல்(கள்) மட்டுமே தவறானது`,
      confidence_percent: Math.round(((7 - minWrongWords) / 7) * 100),
      meter,
      kural: bestCandidate,
      word_diff: {
        hasDifferences: true,
        differenceCount: minWrongWords,
        differences: wrongItems,
        diffResult: bestDiff
      }
    };
  }

  // 3. NOT FOUND (Strict: anything else)
  return {
    status: 'not_found',
    verdict: 'Not Found',
    verdict_ta: 'திருக்குறளில் இல்லை',
    seal: 'red_cracked_seal',
    trust_gauge: 'fabricated',
    confidence_percent: 0,
    meter,
    kural: null,
    nearest_kural: null,
    top_candidates: [],
    message: 'Not found. This kural does not exist in the 1,330 Tirukkural couplets.',
    message_ta: 'திருக்குறளில் இல்லை. இந்த குறள் 1,330 திருக்குறள் பாடல்களில் காணப்படவில்லை.'
  };
}

module.exports = {
  verifyCouplet,
  checkVenbaMeter,
  normalizeTamil
};
