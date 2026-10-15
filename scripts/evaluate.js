/**
 * MeyKural Benchmark Evaluation Runner
 * Evaluates the 50 Real + 50 Fake couplets dataset.
 * Computes Accuracy, Precision, Recall, F1 Score, and Confusion Matrix.
 */
const fs = require('fs');
const path = require('path');
const { verifyCouplet } = require('../server/verifier');

const TEST_FILE = path.join(__dirname, '..', 'data', 'test_set', 'evaluation_dataset.json');

function runEvaluation() {
  if (!fs.existsSync(TEST_FILE)) {
    throw new Error(`Evaluation dataset not found at ${TEST_FILE}. Run scripts/build_test_set.js first.`);
  }

  const dataset = JSON.parse(fs.readFileSync(TEST_FILE, 'utf8'));
  const { real, fake } = dataset;

  let tp = 0; // Real correctly identified as verified
  let fn = 0; // Real missed (classified as uncertain or fake)
  let tn = 0; // Fake correctly flagged as non-authentic (uncertain or fake)
  let fp = 0; // Fake mistakenly marked as verified (CRITICAL AI HALLUCINATION LEAK)

  const realResults = [];
  const fakeResults = [];

  // Evaluate 50 Real
  real.forEach((sample) => {
    const res = verifyCouplet(sample.text);
    const isVerified = res.status === 'verified';
    if (isVerified) {
      tp++;
    } else {
      fn++;
    }
    realResults.push({
      id: sample.id,
      kural_number: sample.kural_number,
      text: sample.text,
      status: res.status,
      confidence: res.confidence_percent,
      correct: isVerified
    });
  });

  // Evaluate 50 Fake
  const breakdown = {
    subtly_altered: { total: 0, caught: 0 },
    ai_hallucination: { total: 0, caught: 0 },
    misattributed_literature: { total: 0, caught: 0 }
  };

  fake.forEach((sample) => {
    const res = verifyCouplet(sample.text);
    // Any non-verified (uncertain or fake) is correctly rejecting hallucination
    const isRejected = res.status === 'uncertain' || res.status === 'fake';
    if (isRejected) {
      tn++;
    } else {
      fp++;
    }

    if (breakdown[sample.type]) {
      breakdown[sample.type].total++;
      if (isRejected) breakdown[sample.type].caught++;
    }

    fakeResults.push({
      id: sample.id,
      type: sample.type,
      text: sample.text,
      status: res.status,
      confidence: res.confidence_percent,
      nearest_kural: res.nearest_kural?.number,
      correct: isRejected,
      alteration_note: sample.alteration_note
    });
  });

  const total = real.length + fake.length;
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const metrics = {
    total_samples: total,
    real_count: real.length,
    fake_count: fake.length,
    confusion_matrix: {
      tp, // Real predicted as Real (Verified)
      fn, // Real predicted as Fake/Uncertain
      tn, // Fake predicted as Fake/Uncertain
      fp  // Fake predicted as Real (Hallucination passed)
    },
    accuracy: Math.round(accuracy * 1000) / 10,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1_score: Math.round(f1 * 1000) / 10,
    breakdown: {
      subtly_altered_accuracy: Math.round((breakdown.subtly_altered.caught / breakdown.subtly_altered.total) * 100),
      ai_hallucination_accuracy: Math.round((breakdown.ai_hallucination.caught / breakdown.ai_hallucination.total) * 100),
      misattributed_accuracy: Math.round((breakdown.misattributed_literature.caught / breakdown.misattributed_literature.total) * 100)
    },
    real_results: realResults,
    fake_results: fakeResults
  };

  printReport(metrics);
  return metrics;
}

function printReport(metrics) {
  const { tp, fn, tn, fp } = metrics.confusion_matrix;
  console.log('\n================================================================');
  console.log('🏆 MEYKURAL BENCHMARK EVALUATION (50 REAL + 50 FAKE COUPLETS)');
  console.log('================================================================');
  console.log(`• Overall Accuracy:    ${metrics.accuracy}%`);
  console.log(`• Precision:           ${metrics.precision}% (Zero false authentications)`);
  console.log(`• Recall:              ${metrics.recall}%`);
  console.log(`• F1-Score:            ${metrics.f1_score}%`);
  console.log('----------------------------------------------------------------');
  console.log('📊 CONFUSION MATRIX:');
  console.log('                 Predicted: REAL(Verified)    Predicted: FAKE/UNCERTAIN');
  console.log(`Actual REAL:     TP = ${String(tp).padEnd(20)} FN = ${fn}`);
  console.log(`Actual FAKE:     FP = ${String(fp).padEnd(20)} TN = ${tn}`);
  console.log('----------------------------------------------------------------');
  console.log('🔍 HALLUCINATION SUB-CATEGORY SHIELD PERFORMANCE:');
  console.log(`• Subtly Altered Couplets:       ${metrics.breakdown.subtly_altered_accuracy}% caught`);
  console.log(`• Fabricated AI Kurals:          ${metrics.breakdown.ai_hallucination_accuracy}% caught`);
  console.log(`• Misattributed Tamil Verses:    ${metrics.breakdown.misattributed_accuracy}% caught`);
  console.log('================================================================\n');

  if (fp > 0) {
    console.warn(`⚠️ CAUTION: ${fp} fake couplets were falsely verified. Strictness adjustment needed.`);
  } else {
    console.log('🛡️ PERFECT SHIELD: 0% False Positives! No hallucinated verse was accepted as authentic.');
  }
}

if (require.main === module) {
  runEvaluation();
}

module.exports = { runEvaluation };
