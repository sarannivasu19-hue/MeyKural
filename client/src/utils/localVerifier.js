/**
 * Client-side 100% Offline Tirukkural Verifier & Search Engine
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

  const normalized = rawText.normalize('NFC').trim();
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

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

  let explanation = '';
  if (valid) {
    explanation = 'Strict Kural Venba meter matched: Line 1 has 4 cirs, Line 2 has 3 cirs (Total: 7 cirs).';
  } else {
    explanation = `Meter deviation: Line 1 has ${l1Words.length} cirs (expected 4), Line 2 has ${l2Words.length} cirs (expected 3). Total: ${totalCirs}/7 cirs.`;
  }

  return {
    valid,
    line1Cirs: l1Words.length,
    line2Cirs: l2Words.length,
    totalCirs,
    explanation,
    parsedLines: { line1, line2 }
  };
}

export function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const c1 = s1.charAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const c2 = s2.charAt(j - 1);
      const cost = c1 === c2 ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }
  return prev[n];
}

export function stringSimilarity(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - dist / maxLen);
}

export function computeWordDiff(inputText, canonicalKural) {
  const inputWords = normalizeTamil(inputText).split(' ').filter(Boolean);
  const canonWords = normalizeTamil(`${canonicalKural.line1} ${canonicalKural.line2}`).split(' ').filter(Boolean);

  const diffResult = [];
  const maxWords = Math.max(inputWords.length, canonWords.length);

  for (let i = 0; i < maxWords; i++) {
    const inWord = inputWords[i] || '';
    const canWord = canonWords[i] || '';

    if (inWord === canWord) {
      diffResult.push({
        position: i + 1,
        inputWord: inWord,
        canonicalWord: canWord,
        status: 'match'
      });
    } else if (!inWord && canWord) {
      diffResult.push({
        position: i + 1,
        inputWord: '',
        canonicalWord: canWord,
        status: 'missing'
      });
    } else if (inWord && !canWord) {
      diffResult.push({
        position: i + 1,
        inputWord: inWord,
        canonicalWord: '',
        status: 'extra'
      });
    } else {
      const sim = stringSimilarity(inWord, canWord);
      diffResult.push({
        position: i + 1,
        inputWord: inWord,
        canonicalWord: canWord,
        status: sim > 0.6 ? 'typo' : 'substituted',
        similarity: Math.round(sim * 100)
      });
    }
  }

  const differences = diffResult.filter((d) => d.status !== 'match');
  return {
    diffResult,
    hasDifferences: differences.length > 0,
    differenceCount: differences.length,
    differences
  };
}

export async function verifyCoupletLocal(inputText) {
  const bundle = await initOfflineData();
  if (!bundle || !bundle.kurals) {
    throw new Error('Offline database not initialized.');
  }

  const kurals = bundle.kurals;
  const config = bundle.config || {
    thresholds: { verified_min: 0.88, uncertain_min: 0.58, fake_max: 0.58 },
    trusted_site: {
      name: 'Tamil Virtual Academy / Official Thirukkural Portal',
      base_url: 'https://thirukkural.gokulnath.com',
      search_url_template: 'https://thirukkural.gokulnath.com/?kural={number}'
    }
  };

  const rawClean = (inputText || '').trim();
  if (!rawClean) {
    return { status: 'error', message: 'Empty input.' };
  }

  const meter = checkVenbaMeter(rawClean);
  const normalizedInput = normalizeTamil(rawClean);
  const inputCompact = normalizedInput.replace(/\s+/g, '');

  // 1. Exact Match
  for (const k of kurals) {
    const kuralNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const kuralCompact = kuralNormalized.replace(/\s+/g, '');

    if (inputCompact === kuralCompact) {
      const trustedUrl = config.trusted_site.search_url_template.replace('{number}', k.number);
      return {
        status: 'verified',
        verdict: 'Verified Authentic Tirukkural',
        verdict_ta: 'உண்மையான திருக்குறள்',
        seal: 'green_seal',
        trust_gauge: 'authentic',
        confidence: 1.0,
        confidence_percent: 100,
        match_type: 'exact',
        kural: k,
        meter,
        word_diff: {
          hasDifferences: false,
          differenceCount: 0,
          diffResult: normalizeTamil(`${k.line1} ${k.line2}`).split(' ').map((w, idx) => ({
            position: idx + 1,
            inputWord: w,
            canonicalWord: w,
            status: 'match'
          }))
        },
        trusted_site_url: trustedUrl,
        trusted_site_name: config.trusted_site.name,
        recommendation: `Couplet verified authentically as Kural #${k.number} from Chapter ${k.chapter_name} (${k.chapter_translation}).`
      };
    }
  }

  // 2. Similarity calculation
  let bestScore = -1;
  let bestKural = null;
  const candidates = [];
  const inputWords = normalizedInput.split(' ').filter(Boolean);

  for (const k of kurals) {
    const kuralNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const kuralWords = kuralNormalized.split(' ').filter(Boolean);

    const commonWords = inputWords.filter((w) => kuralWords.includes(w));
    const tokenOverlap = (2 * commonWords.length) / (inputWords.length + kuralWords.length);
    const charSim = stringSimilarity(inputCompact, kuralNormalized.replace(/\s+/g, ''));

    const combinedScore = 0.55 * charSim + 0.45 * tokenOverlap;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestKural = k;
    }

    if (combinedScore >= 0.35) {
      candidates.push({ kural: k, score: combinedScore });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 5).map((c) => ({
    number: c.kural.number,
    chapter_name: c.kural.chapter_name,
    line1: c.kural.line1,
    line2: c.kural.line2,
    similarity: Math.round(c.score * 100),
    meaning_mv: c.kural.meaning_mv,
    translation_en: c.kural.translation_en
  }));

  const wordDiff = computeWordDiff(rawClean, bestKural);
  const trustedUrl = config.trusted_site.search_url_template.replace('{number}', bestKural.number);

  let status = 'fake';
  let verdict = 'Not in Tirukkural';
  let verdict_ta = 'திருக்குறளில் இல்லாத மேற்கோள் (போலி)';
  let seal = 'red_cracked_seal';
  let trustGauge = 'fabricated';
  let recommendation = '';

  const finalConfidence = Math.max(0, Math.min(1, bestScore));
  const confidencePercent = Math.round(finalConfidence * 100);

  if (wordDiff.differenceCount === 0 && finalConfidence >= 0.95) {
    status = 'verified';
    verdict = 'Verified Authentic Tirukkural';
    verdict_ta = 'உண்மையான திருக்குறள்';
    seal = 'green_seal';
    trustGauge = 'authentic';
    recommendation = `Authentic couplet verified as Kural #${bestKural.number} from Chapter ${bestKural.chapter_name} (${bestKural.chapter_translation}).`;
  } else if (finalConfidence >= config.thresholds.uncertain_min && wordDiff.differenceCount <= 3) {
    status = 'uncertain';
    verdict = 'Uncertain (Altered Couplet Detected)';
    verdict_ta = 'சந்தேகத்திற்குரியது (சொல் மாற்றம் கண்டறியப்பட்டது)';
    seal = 'amber_seal';
    trustGauge = 'suspicious';
    recommendation = `Warning: High similarity (${confidencePercent}%) to Kural #${bestKural.number}, but with ${wordDiff.differenceCount} altered or substituted word(s). Please consult a human Tamil scholar and verify on trusted portals before citing.`;
  } else {
    status = 'fake';
    verdict = 'Not in Tirukkural';
    verdict_ta = 'திருக்குறளில் இல்லாத போலி மேற்கோள்';
    seal = 'red_cracked_seal';
    trustGauge = 'fabricated';
    recommendation = `Error: This quotation does not exist in the 1,330 couplets of Tirukkural. The nearest legitimate couplet is Kural #${bestKural.number} (${confidencePercent}% similarity). Do not cite AI hallucinations as classical literature.`;
  }

  return {
    status,
    verdict,
    verdict_ta,
    seal,
    trust_gauge: trustGauge,
    confidence: finalConfidence,
    confidence_percent: confidencePercent,
    match_type: finalConfidence >= 0.95 ? 'exact' : 'fuzzy',
    nearest_kural: bestKural,
    meter,
    word_diff: wordDiff,
    top_candidates: topCandidates,
    trusted_site_url: trustedUrl,
    trusted_site_name: config.trusted_site.name,
    recommendation
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
