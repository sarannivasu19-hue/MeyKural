const { getAllChapters } = require('../server/db');
const { parseKuralQuery } = require('../server/kuralParser');
const chapters = getAllChapters();

const testQueries = [
  '10வது குறள் சொல்லு',
  'குறள் எண் 10 என்ன?',
  'Tell me Thirukkural number 10.',
  'What is Kural 100?',
  '10வது அதிகாரத்தைச் சொல்லு',
  'அதிகாரம் 10-ல் உள்ள குறள்கள் என்ன?',
  'Show all Kurals in Athikaram 10.',
  'கல்வி அதிகாரத்தை விளக்கு',
  'கல்வி அதிகாரத்தில் உள்ள குறள்கள் என்ன?',
  'Explain the Kalvi Athikaram.',
  'கல்வி அதிகாரத்தில் 5வது குறள் என்ன?',
  'Show the third Kural in Kalvi athikaram.',
  '10வது குறளின் பொருள் என்ன?',
  'Explain Kural 100 in simple Tamil.',
  '2000வது குறள்',
  'திருக்குறளில் கல்வியின் முக்கியத்துவம் என்ன?'
];

console.log('--- Testing parseKuralQuery ---');
testQueries.forEach((q) => {
  const res = parseKuralQuery(q, chapters);
  console.log(`Query: "${q}" => Type: ${res.type}, KuralNum: ${res.kuralNumber || 'N/A'}, AthNum: ${res.athikaramNumber || 'N/A'}, Ch: ${res.chapter?.name || 'N/A'}, Pos: ${res.position || 'N/A'}`);
});
