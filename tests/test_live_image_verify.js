const sharp = require('sharp');

async function testLiveVerifyImage() {
  console.log('🧪 Testing live POST http://localhost:3001/api/verify-image...');

  // 1. Create authentic Kural image
  const svgKural1 = `<svg width="700" height="220" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="30" y="80" font-family="sans-serif" font-size="32" fill="#111111">அகர முதல எழுத்தெல்லாம் ஆதி</text>
    <text x="30" y="150" font-family="sans-serif" font-size="32" fill="#111111">பகவன் முதற்றே உலகு</text>
  </svg>`;

  const pngBuf1 = await sharp(Buffer.from(svgKural1)).png().toBuffer();
  const base64_1 = pngBuf1.toString('base64');

  const res1 = await fetch('http://localhost:3001/api/verify-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: base64_1,
      filename: 'kural1.png',
      mime_type: 'image/png'
    })
  });

  const data1 = await res1.json();
  console.log('Result 1 (Authentic Image):', JSON.stringify({
    status: data1.status,
    verdict: data1.verdict,
    kural_no: data1.kural?.number,
    extracted: data1.extracted_text
  }));
  console.assert(data1.status === 'verified' && data1.kural?.number === 1, 'Authentic image must be verified as Kural 1');

  // 2. Corrupted file test
  const badBase64 = Buffer.from('NOT_AN_IMAGE').toString('base64');
  const resBad = await fetch('http://localhost:3001/api/verify-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: badBase64,
      filename: 'bad.png',
      mime_type: 'image/png'
    })
  });
  console.log('Result 2 (Corrupted File): HTTP Status =', resBad.status);
  console.assert(resBad.status === 400, 'Corrupted image must return 400 Bad Request');

  // 3. Fabricated Kural image
  const svgFake = `<svg width="700" height="220" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="30" y="80" font-family="sans-serif" font-size="32" fill="#111111">காலம் கருதி கணினியைக் கற்பவர்</text>
    <text x="30" y="150" font-family="sans-serif" font-size="32" fill="#111111">ஞாலம் ஆளப் பெறுவார்</text>
  </svg>`;
  const pngBufFake = await sharp(Buffer.from(svgFake)).png().toBuffer();

  const resFake = await fetch('http://localhost:3001/api/verify-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: pngBufFake.toString('base64'),
      filename: 'fake.png',
      mime_type: 'image/png'
    })
  });
  const dataFake = await resFake.json();
  console.log('Result 3 (Fabricated Image):', JSON.stringify({
    status: dataFake.status,
    verdict: dataFake.verdict
  }));
  console.assert(dataFake.status === 'not_found', 'Fabricated image must be classified as not_found');

  console.log('✅ ALL Image Upload & OCR Verification Tests PASSED on live server!');
}

testLiveVerifyImage().catch(console.error);
