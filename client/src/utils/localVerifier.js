/**
 * மெய்க்குறள் (MeyKural) Client-side 100% Offline Tirukkural Verifier
 * The only source of truth is the 1,330 canonical couplets.
 * Exactly 3 Outcomes:
 * 1. VERIFIED: Exact match after Unicode normalization.
 * 2. NEAR MATCH: Matches ONE real couplet except <= MAX_WRONG_WORDS (2 words).
 * 3. NOT FOUND: Anything else. Shows only: "Not found. This kural does not exist in the 1,330 Tirukkural couplets."
 */
import { getBundleFromIndexedDb, saveBundleToIndexedDb } from './indexedDb';

let cachedBundle = null;
let isInitializing = false;
let initPromise = null;

export async function initOfflineData() {
  if (cachedBundle) return cachedBundle;
  if (isInitializing) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      // 1. Try IndexedDB
      const idbData = await getBundleFromIndexedDb();
      if (idbData && idbData.kurals && idbData.kurals.length === 1330) {
        cachedBundle = idbData;
        console.log('⚡ Loaded 1,330 Kurals from IndexedDB (100% offline)');
        return cachedBundle;
      }

      // 2. Fetch static bundle
      console.log('📥 Fetching bundle from /data/thirukurals_bundle.json...');
      const res = await fetch('/data/thirukurals_bundle.json');
      if (res.ok) {
        const bundle = await res.json();
        cachedBundle = bundle;
        saveBundleToIndexedDb(bundle).catch((e) => console.warn('Failed to cache in IDB:', e));
        console.log('✅ Cached 1,330 Kurals into IndexedDB for offline use');
        return cachedBundle;
      }
    } catch (e) {
      console.error('Offline initialization failed:', e);
    } finally {
      isInitializing = false;
    }
    return cachedBundle;
  })();

  return initPromise;
}

export function normalizeTamil(text) {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,;!?"'’‘()\[\]{}—–\-:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkVenbaMeter(rawText) {
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

export async function verifyCoupletLocal(inputText, options = {}) {
  const bundle = await initOfflineData();
  if (!bundle || !bundle.kurals) {
    throw new Error('Offline database not initialized.');
  }

  const kurals = bundle.kurals;
  const maxWrongWords = options.maxWrongWords || bundle.config?.max_wrong_words || 2;

  const rawClean = (inputText || '').trim();
  if (!rawClean) {
    return {
      status: 'not_found',
      verdict: 'Not Found',
      verdict_ta: 'திருக்குறளில் இல்லை',
      message: 'Not found. This kural does not exist in the 1,330 Tirukkural couplets.',
      kural: null
    };
  }

  const meter = checkVenbaMeter(rawClean);
  const normalizedInput = normalizeTamil(rawClean);
  const compactInput = normalizedInput.replace(/\s+/g, '');
  const inputWords = normalizedInput.split(' ').filter(Boolean);

  // 1. EXACT MATCH (VERIFIED)
  for (const k of kurals) {
    const kuralNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const compactKural = kuralNormalized.replace(/\s+/g, '');

    if (compactInput === compactKural) {
      const canonWords = kuralNormalized.split(' ').filter(Boolean);
      return {
        status: 'verified',
        verdict: 'Verified',
        verdict_ta: 'உண்மையான திருக்குறள்',
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

  // 2. NEAR MATCH (<= 2 words wrong)
  let bestCandidate = null;
  let minWrongWords = Infinity;
  let bestDiff = null;

  for (const k of kurals) {
    const canonNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const canonWords = canonNormalized.split(' ').filter(Boolean);

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
    confidence_percent: 0,
    meter,
    kural: null,
    nearest_kural: null,
    top_candidates: [],
    message: 'Not found. This kural does not exist in the 1,330 Tirukkural couplets.',
    message_ta: 'திருக்குறளில் இல்லை. இந்த குறள் 1,330 திருக்குறள் பாடல்களில் காணப்படவில்லை.'
  };
}

export async function getOfflineChapters() {
  const bundle = await initOfflineData();
  return bundle?.chapters || [];
}

export async function getOfflineKuralsByChapter(chapterNum) {
  const bundle = await initOfflineData();
  const kurals = bundle?.kurals || [];
  return kurals.filter((k) => k.chapter_number === Number(chapterNum));
}

export async function searchOfflineKurals(query, options = {}) {
  const bundle = await initOfflineData();
  const kurals = bundle?.kurals || [];
  const { loveOnly, chapter, limit = 20, page = 1 } = options;

  let filtered = kurals;

  if (loveOnly) {
    filtered = filtered.filter((k) => k.chapter_number >= 109 && k.chapter_number <= 133);
  } else if (chapter) {
    filtered = filtered.filter((k) => k.chapter_number === Number(chapter));
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((k) => {
      const matchText = `${k.couplet} ${k.meaning_mv} ${k.meaning_sp} ${k.translation_en}`.toLowerCase();
      return matchText.includes(q);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  return {
    total: filtered.length,
    results: filtered.slice(offset, offset + Number(limit))
  };
}
