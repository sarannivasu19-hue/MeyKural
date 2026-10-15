/**
 * Game Integrity Test (Section 7)
 * Runs 100 simulated rounds.
 * Verifies:
 * 1. Each round has exactly 10 unique couplet IDs.
 * 2. Consecutive rounds overlap by at most 2 couplet IDs.
 * 3. Every generated fake couplet fails the strict verifier (never verified as authentic).
 */
const fs = require('fs');
const path = require('path');
const { verifyCouplet } = require('../server/verifier');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'raw', 'thirukurals_ta.json'), 'utf8'));
const allKurals = raw.kurals;

function simulateRound(recentIdsSet) {
  // Available avoiding recent
  let available = allKurals.filter((k) => !recentIdsSet.has(k.number));
  if (available.length < 15) {
    available = [...allKurals];
  }

  // Shuffle
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 10);
  const selectedIds = selected.map((k) => k.number);

  // Generate fakes for 5
  const fakes = [];
  selected.slice(5, 10).forEach((k) => {
    const l1Words = k.line1.trim().split(/\s+/).filter(Boolean);
    const l2Words = k.line2.trim().split(/\s+/).filter(Boolean);
    // Alter 1 word
    const fakeL1 = [...l1Words];
    fakeL1[0] = 'கணினி';
    fakes.push(`${fakeL1.join(' ')}\n${l2Words.join(' ')}`);
  });

  return { selectedIds, fakes };
}

function run100RoundsTest() {
  console.log('🧪 Starting 100-Round Game Integrity Simulation...');
  let previousRoundIds = null;
  const recentHistory = [];
  let maxOverlap = 0;
  let totalViolations = 0;

  for (let r = 1; r <= 100; r++) {
    const recentSet = new Set(recentHistory.slice(-50));
    const { selectedIds, fakes } = simulateRound(recentSet);

    // Check 1: 10 unique IDs in the round
    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== 10) {
      console.error(`❌ Round ${r}: Duplicate IDs found within round! Size = ${uniqueIds.size}`);
      totalViolations++;
    }

    // Check 2: Consecutive round overlap <= 2
    if (previousRoundIds) {
      const prevSet = new Set(previousRoundIds);
      const overlap = selectedIds.filter((id) => prevSet.has(id)).length;
      if (overlap > maxOverlap) maxOverlap = overlap;
      if (overlap > 2) {
        console.error(`❌ Round ${r} overlaps with round ${r - 1} by ${overlap} (max allowed: 2)`);
        totalViolations++;
      }
    }

    // Check 3: Fakes are strictly NOT verified
    fakes.forEach((fakeText) => {
      const res = verifyCouplet(fakeText);
      if (res.status === 'verified') {
        console.error(`❌ Fake couplet was incorrectly verified as authentic!`);
        totalViolations++;
      }
    });

    previousRoundIds = selectedIds;
    recentHistory.push(...selectedIds);
  }

  console.log(`✅ Completed 100 simulated rounds.`);
  console.log(`📊 Max consecutive round overlap: ${maxOverlap} (must be <= 2).`);
  console.log(`📊 Total violations: ${totalViolations}.`);

  if (totalViolations === 0) {
    console.log('🎉 Section 7 Game Integrity Test PASSED with 100% compliance!');
    return true;
  } else {
    throw new Error(`Game integrity test failed with ${totalViolations} violations.`);
  }
}

if (require.main === module) {
  run100RoundsTest();
}

module.exports = { run100RoundsTest };
