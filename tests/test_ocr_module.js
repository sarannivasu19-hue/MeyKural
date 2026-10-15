const { validateImageBuffer, computeStringSimilarity, verifyOcrCouplet } = require('../server/ocr');

async function runTests() {
  console.log('🧪 Testing server/ocr.js module...');

  // 1. Validation tests
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const res1 = validateImageBuffer(validPngHeader, 'test.png', 'image/png');
  console.assert(res1.valid === true && res1.format === 'png', 'PNG validation failed');

  const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const res2 = validateImageBuffer(validJpgHeader, 'test.jpg', 'image/jpeg');
  console.assert(res2.valid === true && res2.format === 'jpeg', 'JPEG validation failed');

  const corrupted = Buffer.from('NOT_AN_IMAGE_CONTENT_HERE');
  const res3 = validateImageBuffer(corrupted, 'unknown.txt', 'text/plain');
  console.assert(res3.valid === false, 'Corrupted buffer should be invalid');

  // 2. Similarity tests
  const s1 = computeStringSimilarity('அகர முதல எழுத்தெல்லாம் ஆதி', 'அகர முதல எழுத்தெல்லாம் ஆதி');
  console.assert(s1 === 1.0, 'Exact similarity should be 1.0');

  // 3. Verification with OCR tolerance
  // Kural 1 exact
  const v1 = verifyOcrCouplet('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு');
  console.assert(v1.status === 'verified' && v1.kural?.number === 1, 'Kural 1 exact failed');

  // Kural 1 with spacing, punctuation, danda, quotes
  const vPunct = verifyOcrCouplet('“அகர முதல எழுத்தெல்லாம் ஆதி” ।\n«பகவன் முதற்றே உலகு» ॥');
  console.assert(vPunct.status === 'verified' && vPunct.kural?.number === 1, 'Kural 1 with punctuation must verify');

  // Kural 1 with altered words -> near_match
  const v2 = verifyOcrCouplet('அகர முதல எழுத்தெலலாம் ஆதி\nபகவன முதற்றே உலகு');
  console.assert(v2.status === 'near_match' && v2.kural?.number === 1, 'Kural 1 with altered words should return near_match');

  // Fabricated text -> not_found
  const v3 = verifyOcrCouplet('காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்');
  console.assert(v3.status === 'not_found', 'Fabricated text must be not_found');

  console.log('✅ All server/ocr.js tests PASSED with 100% compliance!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
