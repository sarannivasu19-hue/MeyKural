/**
 * Automated test suite for மெய்க்குறள் (MeyKural) Strict Verification Engine
 * Enforces the 3 outcomes: VERIFIED, NEAR MATCH, NOT FOUND.
 */
const { verifyCouplet, checkVenbaMeter, normalizeTamil } = require('../server/verifier');

function runTests() {
  console.log('🧪 Starting Verification Engine Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Unicode NFC Normalization Test
  console.log('--- Test Suite 1: Unicode NFC Normalization ---');
  const decomposed = 'அகர முதல எழுத்தெல்லாம் ஆதி பகவன்'.normalize('NFD');
  const normalized = normalizeTamil(decomposed);
  assert(normalized === normalized.normalize('NFC'), 'Output must be in canonical Unicode NFC form');
  assert(!/[\u200B-\u200D\uFEFF]/.test(normalized), 'Zero-width whitespace stripped correctly');

  // 2. Exact Match Test (Kural 1) -> VERIFIED
  console.log('\n--- Test Suite 2: Exact Authentic Couplet (VERIFIED) ---');
  const kural1 = 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு';
  const res1 = verifyCouplet(kural1);
  assert(res1.status === 'verified', 'Real couplet must return status: "verified"');
  assert(res1.confidence_percent === 100, 'Exact match must have 100% confidence');
  assert(res1.seal === 'green_seal', 'Real couplet must yield green_seal');
  assert(res1.trust_gauge === 'authentic', 'Trust gauge must be "authentic"');
  assert(res1.kural.number === 1, 'Should correctly identify Kural #1');
  assert(res1.word_diff.hasDifferences === false, 'Exact match has 0 differences');
  assert(res1.trusted_site_url.includes('1'), 'Trusted site link must include couplet number');

  // 3. 1-2 Words Changed Test -> NEAR MATCH (Incorrect, needs correction)
  console.log('\n--- Test Suite 3: 1-2 Words Changed (NEAR MATCH) ---');
  const alteredKural2 = 'கற்றதனால் ஆய பயனென்கொல் வாலறிவன்\nபொற்றாள் தொழாஅர் எனின்'; // replaced நற்றாள் with பொற்றாள்
  const res2 = verifyCouplet(alteredKural2);
  assert(res2.status === 'near_match', '1-2 altered words must return status: "near_match"');
  assert(res2.verdict === 'Incorrect, needs correction', 'Verdict must be "Incorrect, needs correction"');
  assert(res2.kural.number === 2, 'Should identify Kural #2 as authentic corrected couplet');
  assert(res2.wrong_words_count <= 2, 'Wrong words count must be <= 2');
  assert(res2.word_diff.hasDifferences === true, 'Must detect word-level differences');

  // 4. Fabricated Couplet (AI Hallucination) -> NOT FOUND
  console.log('\n--- Test Suite 4: Fabricated Couplet (NOT FOUND) ---');
  const fakeVerse = 'காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்';
  const res3 = verifyCouplet(fakeVerse);
  assert(res3.status === 'not_found', 'Made-up couplet must return status: "not_found"');
  assert(res3.message === 'Not found. This kural does not exist in the 1,330 Tirukkural couplets.', 'Message must strictly state not found without invented meaning');
  assert(res3.kural === null, 'Must NOT invent or attach kural data to fake couplet');
  assert(res3.seal === 'red_cracked_seal', 'Fabricated couplet must yield red_cracked_seal');

  // 5. Venba Meter Checker Tests
  console.log('\n--- Test Suite 5: Venba Meter Checker ---');
  const meterValid = checkVenbaMeter('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு');
  assert(meterValid.valid === true, 'Canonical 4+3 couplet must be valid Venba');
  assert(meterValid.line1Cirs === 4, 'Line 1 must contain 4 cirs');
  assert(meterValid.line2Cirs === 3, 'Line 2 must contain 3 cirs');
  assert(meterValid.totalCirs === 7, 'Total cirs must be 7');

  const meterInvalid = checkVenbaMeter('அகர முதல எழுத்தெல்லாம்\nஆதி பகவன் முதற்றே உலகு வாழ்க');
  assert(meterInvalid.valid === false, 'Invalid cir distribution must be flagged');

  // Summary
  console.log('\n==================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed.`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
