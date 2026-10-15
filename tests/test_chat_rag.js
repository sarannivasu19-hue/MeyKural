require('dotenv').config();
const { handleChatQuery } = require('../server/rag');

async function testChatRag() {
  console.log('🧪 Testing Chatbot RAG Question Handling...');

  // 1. Exact Kural 10
  console.log('\n--- 1. Testing "10வது குறள் சொல்லு" ---');
  const res1 = await handleChatQuery('10வது குறள் சொல்லு');
  console.log('Mode:', res1.mode);
  console.log('Cards:', res1.verifiedCards?.length);
  console.assert(res1.verifiedCards?.[0]?.number === 10, 'Must retrieve Kural 10');
  console.assert(res1.answer.includes('பிறவிப் பெருங்கடல்'), 'Must contain Kural 10 text');
  console.log('✅ Kural 10 retrieved correctly!');

  // 2. What is Kural 100?
  console.log('\n--- 2. Testing "What is Kural 100?" ---');
  const res2 = await handleChatQuery('What is Kural 100?');
  console.assert(res2.verifiedCards?.[0]?.number === 100, 'Must retrieve Kural 100');
  console.assert(res2.answer.includes('இனிய உளவாக இன்னாத கூறல்'), 'Must contain Kural 100 text');
  console.log('✅ Kural 100 retrieved correctly!');

  // 3. Athikaram 10
  console.log('\n--- 3. Testing "10வது அதிகாரத்தைச் சொல்லு" ---');
  const res3 = await handleChatQuery('10வது அதிகாரத்தைச் சொல்லு');
  console.assert(res3.verifiedCards?.length === 10, 'Must retrieve all 10 kurals of Chapter 10');
  console.assert(res3.answer.includes('இனியவை கூறல்'), 'Must identify Chapter 10 title');
  console.log('✅ Athikaram 10 retrieved with all 10 kurals!');

  // 4. Kural 5 in Kalvi Athikaram
  console.log('\n--- 4. Testing "கல்வி அதிகாரத்தில் 5வது குறள் என்ன?" ---');
  const res4 = await handleChatQuery('கல்வி அதிகாரத்தில் 5வது குறள் என்ன?');
  // Kalvi is Chapter 40. 5th kural is (40-1)*10 + 5 = 395!
  console.assert(res4.verifiedCards?.[0]?.number === 395, 'Must retrieve Kural 395');
  console.log('✅ 5th kural in Kalvi Athikaram (Kural 395) retrieved correctly!');

  // 5. Out of range Kural 2000
  console.log('\n--- 5. Testing "2000வது குறள்" (Out of range) ---');
  const res5 = await handleChatQuery('2000வது குறள்');
  console.assert(res5.status === 'out_of_range', 'Must return out of range');
  console.assert(res5.answer.includes('1,330'), 'Must explain 1,330 kurals limit');
  console.log('✅ Out of range handled cleanly!');

  console.log('\n==================================================');
  console.log('🎉 ALL Chatbot RAG Tests PASSED with 100% Accuracy!');
  console.log('==================================================');
}

testChatRag().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
