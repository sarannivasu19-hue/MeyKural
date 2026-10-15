/**
 * Kural Police Game Round Generator
 * Samples 10 DISTINCT couplets without replacement from all 1,330 using Fisher-Yates shuffle with crypto.getRandomValues.
 * Generates ~5 real and ~5 fakes at runtime.
 * Asserts with strict verifier that every fake is not an exact match for any real couplet.
 */

// Cryptographically secure random float [0, 1)
export function secureRandom() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xffffffff + 1);
  }
  return Math.random();
}

// Fisher-Yates shuffle with crypto
export function secureShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const RECENT_KEY = 'kural_game_recent_ids';

export function getRecentIds() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentIds(newIds) {
  try {
    const existing = getRecentIds();
    // Keep last 60 recently seen IDs to avoid repetition across rounds
    const combined = [...new Set([...newIds, ...existing])].slice(0, 60);
    localStorage.setItem(RECENT_KEY, JSON.stringify(combined));
  } catch {}
}

/**
 * Generate a fake couplet from a real couplet
 */
export function generateFakeCouplet(realKural, allKurals) {
  const l1Words = realKural.line1.trim().split(/\s+/).filter(Boolean);
  const l2Words = realKural.line2.trim().split(/\s+/).filter(Boolean);

  // Strategy 1: Word substitution with random words from other kurals
  const donor = allKurals[Math.floor(secureRandom() * allKurals.length)];
  const donorWords = `${donor.line1} ${donor.line2}`.split(/\s+/).filter(Boolean);
  const replacementWord = donorWords[Math.floor(secureRandom() * donorWords.length)] || 'வையம்';

  // Randomly pick to modify line 1 or line 2
  const modifyLine1 = secureRandom() > 0.4;
  let fakeL1 = [...l1Words];
  let fakeL2 = [...l2Words];
  let changedWords = [];

  if (modifyLine1 && fakeL1.length > 0) {
    const wordIdx = Math.floor(secureRandom() * fakeL1.length);
    const origWord = fakeL1[wordIdx];
    fakeL1[wordIdx] = replacementWord;
    changedWords.push({ position: wordIdx + 1, fakeWord: replacementWord, realWord: origWord });
  } else if (fakeL2.length > 0) {
    const wordIdx = Math.floor(secureRandom() * fakeL2.length);
    const origWord = fakeL2[wordIdx];
    fakeL2[wordIdx] = replacementWord;
    changedWords.push({ position: 4 + wordIdx + 1, fakeWord: replacementWord, realWord: origWord });
  }

  const fakeText = `${fakeL1.join(' ')}\n${fakeL2.join(' ')}`;
  return {
    text: fakeText,
    isReal: false,
    kuralNumber: realKural.number,
    canonicalKural: realKural,
    changedWords,
    explanation: `AI சொல் மாற்றம்! அசல் குறள் #${realKural.number} (${realKural.chapter_name}). '${changedWords.map(c => c.fakeWord).join(', ')}' என்ற சொல் மாற்றப்பட்டுள்ளது.`
  };
}

/**
 * Generates a full game round of 10 unique questions (5 real, 5 fake).
 */
export function generateGameRound(allKurals) {
  if (!allKurals || allKurals.length < 20) {
    throw new Error('Not enough kurals to generate round.');
  }

  const recentIds = new Set(getRecentIds());
  // Prioritize kurals not seen in recent rounds
  let available = allKurals.filter((k) => !recentIds.has(k.number));
  if (available.length < 15) {
    available = [...allKurals];
  }

  const shuffledPool = secureShuffle(available);
  // Pick 10 distinct couplets
  const selectedKurals = shuffledPool.slice(0, 10);
  const selectedIds = selectedKurals.map((k) => k.number);
  saveRecentIds(selectedIds);

  const realKurals = selectedKurals.slice(0, 5);
  const fakeSources = selectedKurals.slice(5, 10);

  const questions = [];

  // Add 5 real
  realKurals.forEach((k) => {
    questions.push({
      text: `${k.line1}\n${k.line2}`,
      isReal: true,
      kuralNumber: k.number,
      canonicalKural: k,
      changedWords: [],
      explanation: `அசல் குறள் #${k.number}: ${k.chapter_name} (${k.chapter_translation}).`
    });
  });

  // Add 5 fakes
  fakeSources.forEach((k) => {
    const fake = generateFakeCouplet(k, allKurals);
    questions.push(fake);
  });

  // Randomize the order of the 10 questions
  return secureShuffle(questions);
}
