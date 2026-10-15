const { getAllChapters, getCoupletByNumber, getCoupletsByChapter, searchKurals } = require('./db');

// Tamil word to number converter
const TAMIL_NUM_MAP = {
  'ஒன்று': 1, 'ஒன்றாவது': 1, 'முதல்': 1, 'முதலாவது': 1, 'ஒன்றாம்': 1,
  'இரண்டு': 2, 'இரண்டாவது': 2, 'இரண்டாம்': 2,
  'மூன்று': 3, 'மூன்றாவது': 3, 'மூன்றாம்': 3,
  'நான்கு': 4, 'நான்காவது': 4, 'நான்காம்': 4,
  'ஐந்து': 5, 'ஐந்தாவது': 5, 'ஐந்தாம்': 5,
  'ஆறு': 6, 'ஆறாவது': 6, 'ஆறாம்': 6,
  'ஏழு': 7, 'ஏழாவது': 7, 'ஏழாம்': 7,
  'எட்டு': 8, 'எட்டாவது': 8, 'எட்டாம்': 8,
  'ஒன்பது': 9, 'ஒன்பதாவது': 9, 'ஒன்பதாம்': 9,
  'பத்து': 10, 'பத்தாவது': 10, 'பத்தாம்': 10,
  'பதினொன்று': 11, 'பதினொன்றாவது': 11,
  'பன்னிரண்டு': 12, 'பன்னிரண்டாவது': 12,
  'இருபது': 20, 'இருபதாவது': 20,
  'முப்பது': 30, 'முப்பதாவது': 30,
  'நாற்பது': 40, 'நாற்பதாவது': 40,
  'ஐம்பது': 50, 'ஐம்பதாவது': 50,
  'அறுபது': 60, 'அறுபதாவது': 60,
  'எழுபது': 70, 'எழுபதாவது': 70,
  'எண்பது': 80, 'எண்பதாவது': 80,
  'தொண்ணூறு': 90, 'தொண்ணூறாவது': 90,
  'நூறு': 100, 'நூறாவது': 100,
  'கடைசி': 1330, 'இறுதி': 1330, 'ஈற்று': 1330
};

const ENGLISH_ORDINAL_MAP = {
  'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
  'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
  'last': 1330
};

// Common Tamil transliterations of Athikarams
const ATHIKARAM_TRANSLITERATIONS = {
  'kadavul vazhthu': 1, 'kadavul vaazhthu': 1, 'kadavul': 1,
  'vaanshirappu': 2, 'vaan sirappu': 2, 'rain': 2,
  'neethar perumai': 3, 'neethar': 3,
  'aran valiyuruthal': 4,
  'ilvazhkai': 5, 'ilvaazhkai': 5,
  'vazhkkai thunainalam': 6,
  'makkatperu': 7, 'makkal': 7,
  'anbudaimai': 8, 'anbu': 8, 'love': 8,
  'virundhombal': 9, 'virunthu': 9,
  'iniyavai kooral': 10,
  'adakkamudaimai': 13,
  'ozhukkamudaimai': 14, 'ozhukkam': 14,
  'poraimai': 16, 'poraiyudaimai': 16,
  'vaimai': 30, 'vaaimai': 30, 'truth': 30,
  'kollamai': 33,
  'kalvi': 40, 'kalviyal': 40, 'education': 40, 'learning': 40,
  'kallamai': 41,
  'arivudaimai': 43, 'arivu': 43, 'wisdom': 43,
  'suttram thazhal': 53,
  'veeram': 78,
  'natpu': 79, 'natpudaimai': 79, 'friendship': 79,
  'thee natpu': 82,
  'punaludaimai': 102
};

function parseNumber(token) {
  if (!token) return null;
  const clean = token.toLowerCase().trim().replace(/[-\s]/g, '');

  const digitMatch = clean.match(/^(\d+)(?:வது|th|st|nd|rd|ஆம்|ஆவது)?$/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  if (TAMIL_NUM_MAP[clean] !== undefined) {
    return TAMIL_NUM_MAP[clean];
  }

  if (ENGLISH_ORDINAL_MAP[clean] !== undefined) {
    return ENGLISH_ORDINAL_MAP[clean];
  }

  return null;
}

function findChapter(text, allChapters) {
  const lower = text.toLowerCase();

  // Check transliterations first
  for (const [key, num] of Object.entries(ATHIKARAM_TRANSLITERATIONS)) {
    const rx = new RegExp(`\\b${key}\\b`, 'i');
    if (rx.test(lower)) {
      const found = allChapters.find((c) => c.number === num);
      if (found) return found;
    }
  }

  // Exact or substring match in chapter Tamil name or English translation
  for (const ch of allChapters) {
    if (text.includes(ch.name) || lower.includes(ch.translation.toLowerCase())) {
      return ch;
    }
  }

  return null;
}

function parseKuralQuery(message, allChapters = []) {
  const text = message.trim();
  const lower = text.toLowerCase();

  const isAthikaramExplicit = /(?:அதிகார(?:ம்|த்?[\u0B80-\u0BFF]*)|chapter|athikaram)/i.test(text);
  const isKuralExplicit = /(?:(?:திருக்)?குற(?:ள்|ள[\u0B80-\u0BFF]*|ட்பா)|thirukkural|tirukkural|kural|couplet|verse)/i.test(text);
  const isMeaningExplicit = /(?:பொருள்|விளக்கம்|விளக்கு|உரை|meaning|explain|what\s+does|significance)/i.test(text);

  const matchedChapter = findChapter(text, allChapters);

  // 1. Specific Kural within an Athikaram
  if (matchedChapter && (isAthikaramExplicit || text.includes(matchedChapter.name))) {
    const posMatch = text.match(/(?:(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+)\s*(?:வது|ஆம்|th|st|nd|rd|ஆவது)?\s*(?:(?:திருக்)?குற(?:ள்|ள[\u0B80-\u0BFF]*|ட்பா)|kural|verse))/i) ||
                     text.match(/(?:(?:(?:திருக்)?குற(?:ள்|ள[\u0B80-\u0BFF]*|ட்பா)|kural|verse)\s*[:#-]?\s*(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+))/i);
    if (posMatch) {
      const rawPos = posMatch[1];
      const pos = parseNumber(rawPos);
      if (pos && pos >= 1 && pos <= 10) {
        const globalNum = (matchedChapter.number - 1) * 10 + pos;
        return {
          type: 'kural_in_athikaram',
          chapter: matchedChapter,
          position: pos,
          kuralNumber: globalNum,
          isMeaningRequest: isMeaningExplicit
        };
      }
    }
  }

  // 2. Athikaram number
  if (isAthikaramExplicit) {
    const athMatch = text.match(/(?:(?:அதிகார(?:ம்|த்?[\u0B80-\u0BFF]*)|chapter|athikaram)\s*(?:எண்)?\s*[:#-]?\s*(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+))|(?:(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+)\s*(?:வது|th|st|nd|rd|ஆம்|ஆவது)?\s*அதிகார(?:ம்|த்?[\u0B80-\u0BFF]*))/i);
    if (athMatch) {
      const rawVal = athMatch[1] || athMatch[2];
      const num = parseNumber(rawVal);
      if (num !== null) {
        return {
          type: 'athikaram_number',
          athikaramNumber: num,
          wantsAllKurals: /(?:அனைத்து|எல்லா|முழு|குறள்கள்|பத்து|all|kurals|verses|list|show)/i.test(text)
        };
      }
    }

    if (matchedChapter) {
      return {
        type: 'athikaram_name',
        chapter: matchedChapter,
        wantsAllKurals: /(?:அனைத்து|எல்லா|முழு|குறள்கள்|பத்து|all|kurals|verses|list)/i.test(text)
      };
    }
  }

  // 3. Exact Kural number
  // Two clean patterns:
  // A: "குறள் எண் 10", "kural 100", "Thirukkural number 10"
  const kuralAfterRx = /(?:(?:திருக்)?குற(?:ள்|ள[\u0B80-\u0BFF]*|ட்பா)|thirukkural|tirukkural|kural|verse)\s*(?:எண்|number|no\.?)?\s*[:#-]?\s*(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+)/i;
  // B: "10வது குறள்", "10th kural", "முதல் குறள்"
  const kuralBeforeRx = /(\d+|[a-zA-Z]+|[\u0B80-\u0BFF]+)\s*(?:வது|th|st|nd|rd|ஆம்|ஆவது)?\s*(?:(?:திருக்)?குற(?:ள்|ள[\u0B80-\u0BFF]*|ட்பா)|thirukkural|tirukkural|kural|verse)/i;

  if (!isAthikaramExplicit) {
    const matchA = text.match(kuralAfterRx);
    if (matchA) {
      const num = parseNumber(matchA[1]);
      if (num !== null) {
        return {
          type: isMeaningExplicit ? 'kural_meaning' : 'exact_kural',
          kuralNumber: num,
          isMeaningRequest: isMeaningExplicit
        };
      }
    }

    const matchB = text.match(kuralBeforeRx);
    if (matchB) {
      const num = parseNumber(matchB[1]);
      if (num !== null) {
        return {
          type: isMeaningExplicit ? 'kural_meaning' : 'exact_kural',
          kuralNumber: num,
          isMeaningRequest: isMeaningExplicit
        };
      }
    }
  }

  // 4. Bare digit (e.g. "10" or "100")
  const bareDigitMatch = text.match(/^\s*(\d+)\s*$/);
  if (bareDigitMatch) {
    return {
      type: 'exact_kural',
      kuralNumber: parseInt(bareDigitMatch[1], 10),
      isMeaningRequest: false
    };
  }

  // 5. Named Athikaram if "அதிகாரம்" was implicit
  if (matchedChapter && (text.includes('அதிகாரம்') || lower.includes('athikaram') || lower.includes('chapter'))) {
    return {
      type: 'athikaram_name',
      chapter: matchedChapter,
      wantsAllKurals: /(?:அனைத்து|எல்லா|முழு|குறள்கள்|பத்து|all|kurals|verses|list)/i.test(text)
    };
  }

  // 6. General topic question
  return {
    type: 'general_topic',
    query: text,
    matchedChapter: matchedChapter || null
  };
}

module.exports = {
  parseKuralQuery,
  parseNumber,
  findChapter
};
