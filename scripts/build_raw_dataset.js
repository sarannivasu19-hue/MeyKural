/**
 * Fetches canonical Thirukkural dataset, normalizes to Unicode NFC,
 * validates 1,330 couplets, 133 chapters x 10, 2 lines, 7 words (4+3),
 * and saves to data/raw/thirukurals_ta.json.
 */
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const RAW_OUTPUT = path.join(RAW_DIR, 'thirukurals_ta.json');

const HF_URL = 'https://huggingface.co/datasets/kodebot/Thirukural_tamil_with_meaning/resolve/main/thirukurals_ta.json';
const GH_KURALS_URL = 'https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json';
const GH_DETAIL_URL = 'https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json';

// Specific meter standardization for classical sandhi splits to maintain 4 cirs (line 1) + 3 cirs (line 2)
const LINE_FIXES = {
  42: { l1: 'துறந்தார்க்கும் துவ்வா தவர்க்கும் இறந்தார்க்கும்', l2: 'இல்வாழ்வான் என்பான் துணை' },
  60: { l1: 'மங்கலம் என்ப மனைமாட்சி மற்றதன்', l2: 'நன்கலம் நன்மக்கட் பேறு' },
  70: { l2: 'என்நோற்றான் கொல்எனும் சொல்' },
  74: { l2: 'நண்பென்னும் நாடாச் சிறப்பு' },
  82: { l2: 'மருந்தெனினும் வேண்டற்பாற் றன்று' },
  143: { l2: 'தீமை புரிந்துஒழுகு வார்' },
  211: { l2: 'என்ஆற்றுங் கொல்லோ உலகு' },
  347: { l2: 'பற்றி விடாஅ தவர்க்கு' },
  408: { l2: 'கல்லார்கண் பட்ட திரு' },
  530: { l2: 'இழைத்திருந்து எண்ணிக் கொளல்' },
  532: { l2: 'நிச்ச நிரப்புக் கொன்றாங்கு' },
  542: { l2: 'கோல்நோக்கி வாழுங் குடி' },
  689: { l2: 'வாய்சேரா வன்க ணவன்' },
  908: { l2: 'பெட்டாங்கு ஒழுகு பவர்' },
  950: { l2: 'அப்பால் நாற்கூற்றே மருந்து' },
  956: { l2: 'குலம்பற்றி வாழ்தும் என்பார்' },
  976: { l2: 'பேணிக்கொள்வேம் என்னும் நோக்கு' },
  988: { l2: 'திண்மை உண்டாகப் பெறின்' },
  1081: { l2: 'மாதர்கொல் மாலும்என் நெஞ்சு' },
  1117: { l1: 'அறுவாய் நிறைந்த அவிர்மதிக்குப் போல', l2: 'மறுவுண்டோ மாதர் முகத்து' },
  1129: { l2: 'ஏதிலர் என்னும்இவ் வூர்' },
  1130: { l2: 'ஏதிலர் என்னும்இவ் வூர்' },
  1192: { l2: 'வீழ்வார் அளிக்கும் அளி' },
  1284: { l2: 'கூடற்கண் சென்றதுஎன் னெஞ்சு' },
  1307: { l2: 'நீடுவதன்று கொல் என்று' }
};

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'MeyKural-Setup/1.0' } });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      if (i === retries) throw e;
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function prepareDataset() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  console.log('🔄 Checking dataset source...');
  let rawData = null;

  // 1. Try Hugging Face
  console.log(`📡 Attempting Hugging Face: ${HF_URL}`);
  try {
    rawData = await fetchWithRetry(HF_URL, 1);
    console.log('✅ Successfully fetched from Hugging Face');
  } catch (err) {
    console.log(`⚠️ Hugging Face fetch failed or entry not found (${err.message}).`);
    console.log('🔄 Falling back to canonical dataset source & local archive...');
  }

  // 2. Check local file or fallback GitHub
  if (!rawData && fs.existsSync(RAW_OUTPUT)) {
    try {
      const localContent = fs.readFileSync(RAW_OUTPUT, 'utf8');
      const parsed = JSON.parse(localContent);
      if (parsed.kurals && parsed.kurals.length === 1330) {
        console.log('✅ Using existing validated local dataset in data/raw/thirukurals_ta.json');
        return validateAndReport(parsed);
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Fallback to canonical repository
  console.log('🌐 Fetching canonical 1,330 couplets and chapter metadata...');
  const kuralsJson = await fetchWithRetry(GH_KURALS_URL);
  const detailJson = await fetchWithRetry(GH_DETAIL_URL);

  const rawKurals = kuralsJson.kural || kuralsJson;
  const sections = (detailJson[0] || detailJson['0']).section.detail;

  // Parse chapters
  const chapters = [];
  sections.forEach((sec, sIdx) => {
    sec.chapterGroup.detail.forEach((cg) => {
      cg.chapters.detail.forEach((ch) => {
        chapters.push({
          number: ch.number,
          name: ch.name.trim().normalize('NFC'),
          translation: ch.translation.trim(),
          section_number: sIdx + 1,
          section_name: sec.name.trim().normalize('NFC'),
          section_translation: sec.translation.trim(),
          group_name: cg.name.trim().normalize('NFC'),
          group_translation: cg.translation ? cg.translation.trim() : '',
          start: ch.start,
          end: ch.end
        });
      });
    });
  });

  // Map kurals
  const normalizedKurals = rawKurals.map((k) => {
    const num = Number(k.Number);
    const chapterNum = Math.floor((num - 1) / 10) + 1;
    const chapter = chapters.find((c) => c.number === chapterNum) || {};

    let line1 = (LINE_FIXES[num]?.l1 || k.Line1 || '').trim().normalize('NFC').replace(/\s+/g, ' ');
    let line2 = (LINE_FIXES[num]?.l2 || k.Line2 || '').trim().normalize('NFC').replace(/\s+/g, ' ');

    // Strip trailing punctuation like periods if present
    line1 = line1.replace(/[.,;!?]+$/, '');
    line2 = line2.replace(/[.,;!?]+$/, '');

    const fullCouplet = `${line1}\n${line2}`;

    return {
      number: num,
      line1,
      line2,
      couplet: fullCouplet,
      chapter_number: chapterNum,
      chapter_name: chapter.name || '',
      chapter_translation: chapter.translation || '',
      section_number: chapter.section_number || 1,
      section_name: chapter.section_name || '',
      section_translation: chapter.section_translation || '',
      group_name: chapter.group_name || '',
      meaning_mv: (k.mv || '').trim().normalize('NFC'),
      meaning_sp: (k.sp || '').trim().normalize('NFC'),
      meaning_mk: (k.mk || '').trim().normalize('NFC'),
      explanation_ta: (k.explanation || '').trim().normalize('NFC'),
      translation_en: (k.Translation || '').trim(),
      transliteration1: (k.transliteration1 || '').trim(),
      transliteration2: (k.transliteration2 || '').trim()
    };
  });

  const dataset = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    total_kurals: normalizedKurals.length,
    total_chapters: chapters.length,
    chapters,
    kurals: normalizedKurals
  };

  fs.writeFileSync(RAW_OUTPUT, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`💾 Saved normalized dataset to ${RAW_OUTPUT}`);
  return validateAndReport(dataset);
}

function validateAndReport(dataset) {
  console.log('\n==================================================');
  console.log('📊 TIRUKKURAL DATASET VALIDATION REPORT');
  console.log('==================================================');

  const kurals = dataset.kurals;
  const chapters = dataset.chapters;

  const totalKurals = kurals.length;
  const totalChapters = chapters.length;

  let line1ValidCount = 0;
  let line2ValidCount = 0;
  let nfcValidCount = 0;
  let chapterCountIssues = 0;

  // Check 133 chapters x 10 kurals
  const chapterBuckets = {};
  for (let c = 1; c <= 133; c++) {
    chapterBuckets[c] = 0;
  }

  kurals.forEach((k) => {
    // Check NFC
    if (k.line1 === k.line1.normalize('NFC') && k.line2 === k.line2.normalize('NFC')) {
      nfcValidCount++;
    }

    // Check cirs (words)
    const w1 = k.line1.trim().split(/\s+/).filter(Boolean);
    const w2 = k.line2.trim().split(/\s+/).filter(Boolean);

    if (w1.length === 4) line1ValidCount++;
    if (w2.length === 3) line2ValidCount++;

    if (chapterBuckets[k.chapter_number] !== undefined) {
      chapterBuckets[k.chapter_number]++;
    }
  });

  for (let c = 1; c <= 133; c++) {
    if (chapterBuckets[c] !== 10) {
      chapterCountIssues++;
    }
  }

  console.log(`• Total Couplets:      ${totalKurals} / 1,330 ${totalKurals === 1330 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Total Adhikarams:    ${totalChapters} / 133   ${totalChapters === 133 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• 10 Kurals/Adhikaram: ${133 - chapterCountIssues} / 133 chapters ${chapterCountIssues === 0 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Line 1 (4 cirs):     ${line1ValidCount} / 1,330 ${line1ValidCount === 1330 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Line 2 (3 cirs):     ${line2ValidCount} / 1,330 ${line2ValidCount === 1330 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Unicode NFC Form:    ${nfcValidCount} / 1,330 ${nfcValidCount === 1330 ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log('==================================================\n');

  if (totalKurals !== 1330 || totalChapters !== 133 || chapterCountIssues !== 0) {
    throw new Error('Dataset validation failed: counts do not match canonical Tirukkural criteria!');
  }

  return dataset;
}

if (require.main === module) {
  prepareDataset().catch((err) => {
    console.error('Fatal error during dataset preparation:', err);
    process.exit(1);
  });
}

module.exports = { prepareDataset, validateAndReport };
