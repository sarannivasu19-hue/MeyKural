/**
/**
 * மெய்க்குறள் (MeyKural) Authoritative Image Upload, Preprocessing, and Tamil OCR Pipeline
 * 
 * Pipeline:
 * 1. File Validation: MIME & Buffer Magic Byte inspection (JPEG, PNG, WebP, HEIC/HEIF).
 * 2. Preprocessing via sharp: EXIF auto-rotation, downscaling, contrast normalization, sharpening.
 * 3. High-Accuracy Tamil OCR: Gemini Vision (primary) & Unicode normalization.
 * 4. Controlled Similarity Verification: Matches against 1,330 canonical couplets with OCR tolerance.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { verifyCouplet, normalizeTamil, checkVenbaMeter } = require('./verifier');

const RAW_PATH = path.join(__dirname, '..', 'data', 'raw', 'thirukurals_ta.json');
let kuralsData = null;

function getKuralsData() {
  if (!kuralsData) {
    const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
    kuralsData = raw.kurals;
  }
  return kuralsData;
}

/**
 * Validates file magic bytes and MIME type.
 * Returns { valid: boolean, format: string, error?: string }
 */
async function validateImageBuffer(buffer, originalName = '', mimeType = '') {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file provided.' };
  }

  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (buffer.length > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds maximum allowed limit (15MB).' };
  }

  // Check magic bytes
  const header = buffer.slice(0, 12);
  const hex = header.toString('hex');

  let detectedFormat = null;

  // JPEG: FF D8 FF
  if (hex.startsWith('ffd8ff')) {
    detectedFormat = 'jpeg';
  }
  // PNG: 89 50 4E 47
  else if (hex.startsWith('89504e47')) {
    detectedFormat = 'png';
  }
  // WebP: RIFF .... WEBP
  else if (hex.startsWith('52494646') && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    detectedFormat = 'webp';
  }
  // HEIF/HEIC: ftyp box with heic/heix/mif1/msf1
  else if (buffer.length >= 12 && buffer.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) {
      detectedFormat = 'heic';
    }
  }

  // Fallback: try sharp metadata detection for valid images with uncommon headers
  if (!detectedFormat) {
    try {
      const meta = await sharp(buffer).metadata();
      if (meta && meta.format) {
        detectedFormat = meta.format; // 'jpeg', 'png', 'webp', 'heif', etc.
      }
    } catch (_) {
      // sharp couldn't identify it either
    }
  }

  if (!detectedFormat) {
    return {
      valid: false,
      error: 'Unsupported file format or corrupted image. Please upload a valid JPG, PNG, WebP, or HEIC image.'
    };
  }

  return { valid: true, format: detectedFormat };
}

/**
 * Preprocess image for OCR without destructive binarization.
 * Auto-rotates according to EXIF, resizes if too large, normalizes contrast, and sharpens.
 */
async function preprocessImageBuffer(buffer) {
  try {
    // Verify image integrity with sharp
    const meta = await sharp(buffer, { failOnError: false }).metadata();
    if (!meta || !meta.format) {
      throw new Error('Image preprocessing failed: Input buffer contains unsupported image format');
    }

    const pipeline = sharp(buffer, { failOnError: false })
      .rotate() // Auto-orient based on EXIF
      .resize({
        width: 2200,
        height: 2200,
        fit: 'inside',
        withoutEnlargement: true
      })
      .grayscale()
      .normalize() // Linear contrast stretch
      .sharpen();

    const outputBuffer = await pipeline.png().toBuffer();
    return outputBuffer;
  } catch (err) {
    // If sharp still fails, return the original buffer so OCR can attempt it directly
    console.warn('sharp preprocessing failed, using raw buffer for OCR:', err.message);
    return buffer;
  }
}

/**
 * Perform Tamil OCR using Gemini Multimodal Vision API
 */
async function performTamilOcr(imageBuffer) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('Gemini API key is not configured for backend OCR.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const prompt = `You are a high-accuracy Tamil OCR engine for Classical Literature.
Extract ALL Tamil text present in this image accurately.
Rules:
1. Preserve all Tamil letters, combining vowels, and pulli marks (புள்ளி).
2. Preserve original line breaks.
3. If a Thirukkural couplet (2 lines) is present, extract it exactly as written.
4. Output ONLY the extracted text. Do not add any greeting, explanation, translation, or markdown code blocks.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/png',
              data: imageBuffer.toString('base64')
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 1000
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OCR service error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

/**
 * Computes character-level Levenshtein similarity between two strings (0.0 to 1.0)
 */
function computeStringSimilarity(str1, str2) {
  const s1 = str1 || '';
  const s2 = str2 || '';
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 && l2 === 0) return 1.0;
  if (l1 === 0 || l2 === 0) return 0.0;

  const d = [];
  for (let i = 0; i <= l1; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= l2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= l1; i++) {
    for (let j = 1; j <= l2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = d[l1][l2];
  const maxLen = Math.max(l1, l2);
  return 1 - (distance / maxLen);
}

/**
 * Extracts candidate couplet lines from multi-line text (e.g. if photo contains chapter name or noise)
 */
function extractCoupletLines(rawOcrText) {
  if (!rawOcrText) return '';
  const lines = rawOcrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // If already 2 lines, return as is
  if (lines.length === 2) {
    return `${lines[0]}\n${lines[1]}`;
  }

  // If 1 single line with >= 7 words, format as 4 + 3
  if (lines.length === 1) {
    const words = lines[0].split(/\s+/).filter(Boolean);
    if (words.length >= 7) {
      return `${words.slice(0, 4).join(' ')}\n${words.slice(4).join(' ')}`;
    }
    return lines[0];
  }

  // If multi-line: check pairs of adjacent lines to find the pair with highest Tamil content
  let bestCandidate = `${lines[0]}\n${lines[1]}`;
  let maxTamilChars = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    const candidate = `${lines[i]}\n${lines[i + 1]}`;
    const tamilChars = (candidate.match(/[\u0B80-\u0BFF]/g) || []).length;
    if (tamilChars > maxTamilChars) {
      maxTamilChars = tamilChars;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

/**
 * Controlled Verification Logic for OCR output.
 * 1. Checks exact match.
 * 2. Checks near match (1-2 words changed).
 * 3. Checks similarity against canonical couplets to tolerate minor OCR character noise.
 */
function verifyOcrCouplet(extractedText) {
  const kurals = getKuralsData();
  const candidateText = extractCoupletLines(extractedText);

  // 1. First run the standard deterministic verifier
  const standardResult = verifyCouplet(candidateText);

  if (standardResult.status === 'verified') {
    return {
      ...standardResult,
      extracted_text: candidateText,
      ocr_tolerance_applied: false
    };
  }

  if (standardResult.status === 'near_match') {
    return {
      ...standardResult,
      extracted_text: candidateText,
      ocr_tolerance_applied: false
    };
  }

  // 2. Controlled Similarity Lookup across all 1,330 Kurals to tolerate OCR artifacts
  const normalizedCandidate = normalizeTamil(candidateText);
  const compactCandidate = normalizedCandidate.replace(/\s+/g, '');

  if (compactCandidate.length < 15) {
    return {
      ...standardResult,
      extracted_text: candidateText,
      message: 'Not found. No sufficient Tamil text found to match with Thirukkural.'
    };
  }

  let bestKural = null;
  let bestSimilarity = 0;

  for (const k of kurals) {
    const canonNormalized = normalizeTamil(`${k.line1} ${k.line2}`);
    const compactCanon = canonNormalized.replace(/\s+/g, '');
    const sim = computeStringSimilarity(compactCandidate, compactCanon);

    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestKural = k;
    }
  }

  // If similarity is very high (>= 88%), it matches this authentic Kural with slight OCR glyph noise
  if (bestKural && bestSimilarity >= 0.88) {
    const canonNormalized = normalizeTamil(`${bestKural.line1} ${bestKural.line2}`);
    const canonWords = canonNormalized.split(' ').filter(Boolean);
    const candidateWords = normalizedCandidate.split(' ').filter(Boolean);

    // Calculate word differences
    let mismatchCount = 0;
    const maxWords = Math.max(candidateWords.length, canonWords.length);
    for (let i = 0; i < maxWords; i++) {
      if ((candidateWords[i] || '') !== (canonWords[i] || '')) {
        mismatchCount++;
      }
    }

    // If 1-2 words are genuinely different, label as near_match
    if (mismatchCount >= 1 && mismatchCount <= 2 && bestSimilarity < 0.95) {
      return {
        status: 'near_match',
        verdict: 'Incorrect, needs correction',
        verdict_ta: 'தவறானது, திருத்தம் தேவை',
        seal: 'amber_seal',
        trust_gauge: 'suspicious',
        trusted_site_url: `https://thirukkural.gokulnath.com/?kural=${bestKural.number}`,
        wrong_words_count: mismatchCount,
        confidence_percent: Math.round(bestSimilarity * 100),
        kural: bestKural,
        extracted_text: candidateText,
        ocr_tolerance_applied: true,
        message: `OCR matched Kural #${bestKural.number} with minor variations (${mismatchCount} words different).`
      };
    }

    // High similarity (>= 88% and minor glyph variations) -> Verified Authentic Kural
    return {
      status: 'verified',
      verdict: 'Verified',
      verdict_ta: 'உண்மையான திருக்குறள்',
      seal: 'green_seal',
      trust_gauge: 'authentic',
      trusted_site_url: `https://thirukkural.gokulnath.com/?kural=${bestKural.number}`,
      confidence_percent: Math.min(100, Math.round(bestSimilarity * 100)),
      kural: bestKural,
      wrong_words_count: 0,
      extracted_text: candidateText,
      ocr_tolerance_applied: true,
      message: `Verified: Matched canonical Kural #${bestKural.number} (${bestKural.chapter_name}).`
    };
  }

  // 3. Genuine Not Found
  return {
    status: 'not_found',
    verdict: 'Not Found',
    verdict_ta: 'திருக்குறளில் இல்லை',
    seal: 'red_cracked_seal',
    trust_gauge: 'fabricated',
    confidence_percent: Math.round(bestSimilarity * 100),
    kural: null,
    extracted_text: candidateText,
    message: 'Not found. The extracted text does not match any of the 1,330 Thirukkural couplets.',
    message_ta: 'திருக்குறளில் இல்லை. படத்திலிருந்து பெறப்பட்ட உரை 1,330 திருக்குறள்களில் காணப்படவில்லை.'
  };
}

module.exports = {
  validateImageBuffer,
  preprocessImageBuffer,
  performTamilOcr,
  verifyOcrCouplet,
  computeStringSimilarity,
  extractCoupletLines
};
