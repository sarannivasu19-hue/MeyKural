/**
 * Generates the standardized 50 Real + 50 Fake couplets evaluation dataset
 * for Tamil Hackathon 2026 Problem P15 benchmark.
 */
const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '..', 'data', 'raw', 'thirukurals_ta.json');
const TEST_DIR = path.join(__dirname, '..', 'data', 'test_set');
const TEST_FILE = path.join(TEST_DIR, 'evaluation_dataset.json');

if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function buildTestSet() {
  const dataset = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  const kurals = dataset.kurals;

  // 1. Select 50 Real Kurals distributed across all 3 Paals
  // Sample indices: 1, 2, 3, 10, 11, 25, 31, 41, 55, 60, 71, 80, 91, 101, 110,
  // 120, 131, 150, 175, 200, 211, 250, 300, 331, 391, 392, 400, 450, 500, 550,
  // 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250,
  // 1300, 1310, 1320, 1325, 1328, 1330
  const realIndices = [
    1, 2, 3, 10, 11, 25, 31, 41, 55, 60,
    71, 80, 91, 101, 110, 120, 131, 150, 175, 200,
    211, 250, 300, 331, 391, 392, 400, 450, 500, 550,
    600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050,
    1100, 1150, 1200, 1250, 1300, 1310, 1320, 1325, 1328, 1330
  ];

  const realCouplets = realIndices.map((num, i) => {
    const k = kurals.find((item) => item.number === num);
    return {
      id: `REAL_${String(i + 1).padStart(3, '0')}`,
      type: 'real',
      expected: 'verified',
      kural_number: k.number,
      chapter_number: k.chapter_number,
      chapter_name: k.chapter_name,
      text: `${k.line1}\n${k.line2}`,
      line1: k.line1,
      line2: k.line2,
      description: `Authentic Kural #${k.number} from Adhikaram ${k.chapter_name}`
    };
  });

  // 2. 50 Fake couplets
  // Category A: 20 Subtly altered (1-2 words substituted, changed meaning, AI perturbation)
  const subtlyAltered = [
    {
      baseKural: 1,
      text: "அகர முதல எழுத்தெல்லாம் ஆதிபகவன்\nமுதற்றே உலகம்", // Missing cir in line 2
      alteration: "Missing word 'முதற்றே' and modified rhythm",
      expected: "uncertain"
    },
    {
      baseKural: 2,
      text: "கற்றதனால் ஆய பயனென்கொல் வாலறிவன்\nநற்றாள் தொழாஅர் எனின்", // Replace நற்றாள் with பொற்றாள்
      alteredText: "கற்றதனால் ஆய பயனென்கொல் வாலறிவன்\nபொற்றாள் தொழாஅர் எனின்",
      alteration: "Word replacement: நற்றாள் -> பொற்றாள்",
      expected: "uncertain"
    },
    {
      baseKural: 391,
      alteredText: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தகாத", // தக -> தகாத
      alteration: "Word replacement: தக -> தகாத (inverts moral meaning)",
      expected: "uncertain"
    },
    {
      baseKural: 392,
      alteredText: "எண்ணென்ப ஏனை எழுத்தென்ப இவ்விரண்டும்\nமனிதர்க்குக் கண்என்ப வாழும் உயிர்க்கு",
      alteration: "Word substitution: கண்ணென்ப -> மனிதர்க்குக் கண்என்ப",
      expected: "uncertain"
    },
    {
      baseKural: 31,
      alteredText: "சிறப்பீனும் செல்வமும் ஈனும் அறத்தினூங்கு\nஆக்கம் எவனோ உயிர்க்கு", // ஆக்கம் -> செல்வம்
      alteration: "Word substitution: செல்வமும் -> செல்வமும் ஈனும் duplicate",
      expected: "uncertain"
    },
    {
      baseKural: 41,
      alteredText: "இல்வாழ்வான் என்பான் இயல்புடைய மூவர்க்கும்\nநல்லாற்றின் நின்ற துணைவன்", // துணை -> துணைவன்
      alteration: "Word substitution: துணை -> துணைவன்",
      expected: "uncertain"
    },
    {
      baseKural: 60,
      alteredText: "மங்கலம் என்ப மனைமாட்சி மற்றதன்\nபொன்கலம் நன்மக்கட் பேறு", // நன்கலம் -> பொன்கலம்
      alteration: "Word substitution: நன்கலம் -> பொன்கலம்",
      expected: "uncertain"
    },
    {
      baseKural: 71,
      alteredText: "அன்பிற்கும் உண்டோ அடைக்குந்தாழ் ஆர்வலர்\nபுண்கணீர் பூசல் தரும்", // அன்பிற்கும் vs அன்பிற்கும்
      alteredText: "பாசத்திற்கும் உண்டோ அடைக்குந்தாழ் ஆர்வலர்\nபுண்கணீர் பூசல் தரும்",
      alteration: "Word replacement: அன்பிற்கும் -> பாசத்திற்கும்",
      expected: "uncertain"
    },
    {
      baseKural: 101,
      alteredText: "செய்யாமல் செய்த உதவிக்கு வானகமும்\nவையகமும் ஆற்றல் அரிது",
      alteration: "Word replacement: வானகமும் வையகமும் order flipped",
      expected: "uncertain"
    },
    {
      baseKural: 110,
      alteredText: "எந்நன்றி கொன்றார்க்கும் உய்வுண்டாம் உய்வில்லை\nநன்றி மறந்த மனிதர்க்கு", // மகற்கு -> மனிதர்க்கு
      alteration: "Modernized vocabulary: மகற்கு -> மனிதர்க்கு",
      expected: "uncertain"
    },
    {
      baseKural: 131,
      alteredText: "ஒழுக்கம் விழுப்பம் தரலான் ஒழுக்கம்\nஉயிரினும் ஓம்பப் படாதது", // படப்படும் -> படாதது
      alteration: "Negation hallucination: படப்படும் -> படாதது",
      expected: "uncertain"
    },
    {
      baseKural: 200,
      alteredText: "சொல்லுக சொல்லில் பயனுடைய சொல்லற்க\nசொல்லில் பயனிலாச் சொல்", // பயனிலாச் -> வீணான
      alteredText: "சொல்லுக சொல்லில் பயனுடைய சொல்லற்க\nசொல்லில் பயனிலா மொழி",
      alteration: "Synonym substitution: சொல் -> மொழி",
      expected: "uncertain"
    },
    {
      baseKural: 211,
      alteredText: "கைம்மாறு வேண்டா கடப்பாடு மாரிமாட்டு\nஎன்ன செய்யும் உலகினர்", // என்ஆற்றுங் கொல்லோ உலகு
      alteration: "Colloquial modernization: என்ன செய்யும் உலகினர்",
      expected: "uncertain"
    },
    {
      baseKural: 300,
      alteredText: "யாதானும் நாடாமல் ஊராமல் என்னொருவன்\nசாந்துணையும் கல்லாத வாறு",
      alteration: "Grammar alteration: நாடாமல் ஊராமல்",
      expected: "uncertain"
    },
    {
      baseKural: 331,
      alteredText: "நெருநல் உளனொருவன் இன்றில்லை என்னும்\nபெருமை உடைத்துஇவ் வுலகு",
      alteration: "Word replacement: பெருமை -> சிறுமை inverted",
      alteredText: "நெருநல் உளனொருவன் இன்றில்லை என்னும்\nசிறுமை உடைத்துஇவ் வுலகு",
      expected: "uncertain"
    },
    {
      baseKural: 400,
      alteredText: "கேடில் விழுச்செல்வம் கல்வி ஒருவற்கு\nமாடல்ல மற்றை யவைதான்", // யவை -> யவைதான்
      alteration: "Ending syllable pad: யவை -> யவைதான்",
      expected: "uncertain"
    },
    {
      baseKural: 550,
      alteredText: "கொலையிற் கொடியாரை வேந்தொறுத்தல் பைங்கூழ்\nகளைகட் டதனோடு சமம்", // நேர் -> சமம்
      alteration: "Sanskrit loanword replacement: நேர் -> சமம்",
      expected: "uncertain"
    },
    {
      baseKural: 650,
      alteredText: "ஈன்றாள் பசிகாண்பான் ஆயினும் செய்யற்க\nசான்றோர் பழிக்கும் வினை", // பழிக்கும் செயல்
      alteredText: "ஈன்றாள் பசிகாண்பான் ஆயினும் செய்யற்க\nசான்றோர் பழிக்கும் செயல்",
      alteration: "Word substitution: வினை -> செயல்",
      expected: "uncertain"
    },
    {
      baseKural: 750,
      alteredText: "செய்க பொருளைச் செறுநர் செருக்கறுக்கும்\nஎஃகதனsound கூரிய தில்",
      alteredText: "செய்க செல்வத்தைச் செறுநர் செருக்கறுக்கும்\nஎஃகதனிற் கூரிய தில்",
      alteration: "Word replacement: பொருளை -> செல்வத்தை",
      expected: "uncertain"
    },
    {
      baseKural: 1100,
      alteredText: "கண்ணுள்ளின் போகா இமைப்பின் கரப்பறியா\nநுண்ணியள் எம்மனைவி காண்", // எம் காதலி -> எம்மனைவி
      alteration: "AI contextual hallucination: காதலி -> எம்மனைவி",
      expected: "uncertain"
    }
  ];

  // Category B: 15 LLM Stylistic Hallucinations (Look and sound like Kurals but 100% fabricated)
  const aiHallucinations = [
    {
      text: "கற்றவர் யாவரும் காலத்தின் முன்னிற்கப்\nபெற்றவர் நெஞ்சம் மகிழும்",
      alteration: "LLM generated Venba hallucination on Education",
      expected: "fake"
    },
    {
      text: "அன்பும் அறனும் அறிவும் உடையார்க்குத்\nதுன்பம் ஒருபோதும் இல்லை",
      alteration: "AI moralizing proverb formatted as Kural",
      expected: "fake"
    },
    {
      text: "பொய்யாமை என்னும் புகழுடைமை போற்றிடினும்\nமெய்யாமை வெல்லும் வினை",
      alteration: "AI pseudo-Tirukkural wordplay on Truth",
      expected: "fake"
    },
    {
      text: "இல்லறம் பேணி இயற்கையோடு வாழ்பவர்\nநல்லறம் கண்ட தலைவர்",
      alteration: "AI eco-friendly life couplet hallucination",
      expected: "fake"
    },
    {
      text: "காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்",
      alteration: "Anachronistic AI fabrication introducing computer/kannini",
      expected: "fake"
    },
    {
      text: "தாயிற் சிறந்த தயவான தெய்வம்\nஆயிரத் தாண்டிலும் இல்லை",
      alteration: "Colloquial Tamil lyric disguised as Kural",
      expected: "fake"
    },
    {
      text: "நட்பும் பகையும் நமக்குள் அடங்கிடின்\nவெற்றி நமதாகும் என்று",
      alteration: "AI inspirational couplet mimicry",
      expected: "fake"
    },
    {
      text: "செல்வம் பெருகினும் செருக்கு அடையாதவர்\nகல்வி சிறந்தவர் தாம்",
      alteration: "AI pseudo-moral verse on Wealth",
      expected: "fake"
    },
    {
      text: "வாழும் உயிர்க்கெல்லாம் வழிகாட்டும் வள்ளுவர்\nகோலும் குடையும் சமம்",
      alteration: "Self-referential AI fabrication claiming to be Kural",
      expected: "fake"
    },
    {
      text: "எண்ணும் எழுத்தும் இணையத்தில் சேர்ப்பவர்\nகண்ணென வாழ்வார் புவி",
      alteration: "Anachronistic AI hallucination introducing Internet/Inaiyam",
      expected: "fake"
    },
    {
      text: "உழைப்பே உயர்வு தரும்என்று உரைப்பவர்\nபிழைப்பின்றி வாழ்வார் நிலத்து",
      alteration: "Modern labor slogan formatted as 7-word couplet",
      expected: "fake"
    },
    {
      text: "பொறுத்தார் பூமி ஆள்வார் எனினும்\nஅறுத்தார் அடைவார் அவலம்",
      alteration: "Tamil proverb blended with AI rhyming line",
      expected: "fake"
    },
    {
      text: "மண்ணில் பிறந்த மனிதர் எவர்க்கும்\nகண்ணியமே மூலதனம் காண்",
      alteration: "Modern Tamil verse on Dignity as capital",
      expected: "fake"
    },
    {
      text: "அன்னையும் பிதாவும் அடிபணிந்து போற்றுவோர்\nமுன்னே நடக்கும் அறம்",
      alteration: "Konrai Vendhan concept masked into Kural format",
      expected: "fake"
    },
    {
      text: "தீதும் நன்றும் பிறர்தர வாரா\nமாதரார் போற்றும் மனம்",
      alteration: "Purananuru quote mangled into second line fabrication",
      expected: "fake"
    }
  ];

  // Category C: 15 Non-Kural Tamil verses, Aathichudi, Bharathiyar quotes misattributed to Tirukkural
  const misattributedVerses = [
    {
      text: "அறம் செய்ய விரும்பு ஆறுவது சினம்\nஇயல்வது கரவேல் ஈவது விலக்கேல்",
      alteration: "Avvaiyar Aathichudi misattributed to Tirukkural",
      expected: "fake"
    },
    {
      text: "சென்றிடுவீர் எட்டுத் திக்கும் கலைச் செல்வங்கள்\nயாவும் கொணர்ந்திங்கு சேர்ப்பீர்",
      alteration: "Mahakavi Bharathiyar poem misattributed to Tirukkural",
      expected: "fake"
    },
    {
      text: "யாதும் ஊரே யாவரும் கேளிர் தீதும்\nநன்றும் பிறர்தர வாரா",
      alteration: "Kaniyan Pungundranar Purananuru 192 misattributed to Kural",
      expected: "fake"
    },
    {
      text: "தமிழுக்கும் அமுதென்று பேர் அந்தத் தமிழ்\nஇன்பத் தமிழ்எங்கள் உயிருக்கு நேர்",
      alteration: "Pavendhar Bharathidasan poem misattributed to Kural",
      expected: "fake"
    },
    {
      text: "உடம்பார் அழியின் உயிரார் அழிவர்\nதிடம்பட மெய்ஞ்ஞானம் சேரவும் மாட்டார்",
      alteration: "Thirumoolar Thirumandhiram misattributed to Tirukkural",
      expected: "fake"
    },
    {
      text: "தித்திக்கும் தெள்ளமுதாய் தெள்ளமுதின் மேலான\nமுத்திக் கனியேஎன் முத்தமிழே",
      alteration: "Tamil Vidu Thoothu invocatory verse",
      expected: "fake"
    },
    {
      text: "சாதி இரண்டொழிய வேறில்லை சாற்றுங்கால்\nநீதி நெறிநின்ற நெறிஞர்",
      alteration: "Avvaiyar Nalvazhi verse",
      expected: "fake"
    },
    {
      text: "பொருளல் லவரைப் பொருளாகச் செய்யும்\nபொருளல்ல தில்லை காசு", // காசு instead of பொருள்
      alteration: "Slang corruption of Kural 751 with modern slang 'காசு'",
      expected: "uncertain"
    },
    {
      text: "வானரங்கள் கனி கொடுத்து மந்தியொடு கொஞ்சும்\nகானவர்கள் விழி எறிந்து வானவர்கள் நாணும்",
      alteration: "Kutralak Kuravanji lyric",
      expected: "fake"
    },
    {
      text: "ஒன்றுபட்டால் உண்டு வாழ்வே நம்மில்\nஒற்றுமை நீங்கில் அனைவர்க்கும் தாழ்வே",
      alteration: "Bharathiyar unity verse misattributed to Kural",
      expected: "fake"
    },
    {
      text: "ஓடி விளையாடு பாப்பா நீ ஓய்ந்திருக்க\nலாகாது பாப்பா கூடி விளையாடு",
      alteration: "Bharathiyar Paappa Paattu",
      expected: "fake"
    },
    {
      text: "நன்றி ஒருவருக்குச் செய்தக்கால் அந்நன்றி\nஎன்று தருங்கொல் எனவேண்டா",
      alteration: "Moothurai verse by Avvaiyar",
      expected: "fake"
    },
    {
      text: "வாடிய பயிரைக் கண்டபோதெல்லாம் வாடினேன்\nபசியினால் இளைத்தே வீடுதோறும்",
      alteration: "Vallalar Ramalinga Adigal Thiruvarutpa",
      expected: "fake"
    },
    {
      text: "பிறப்பொக்கும் எல்லா உயிர்க்கும் சிறப்பொவ்வா\nசாதிகள் இல்லை உலகில்", // Modified Kural 972
      alteration: "Modified Kural 972 ending with political slogan",
      expected: "uncertain"
    },
    {
      text: "கற்கை நன்றே கற்கை நன்றே\nபிச்சை புகினும் கற்கை நன்றே",
      alteration: "Vetri Verkai (Athiveerarama Pandiyar) quotation",
      expected: "fake"
    }
  ];

  const fakeCouplets = [];

  subtlyAltered.forEach((item, idx) => {
    fakeCouplets.push({
      id: `FAKE_ALT_${String(idx + 1).padStart(3, '0')}`,
      type: 'subtly_altered',
      expected: item.expected || 'uncertain',
      text: (item.alteredText || item.text).trim().normalize('NFC'),
      base_kural_number: item.baseKural,
      alteration_note: item.alteration
    });
  });

  aiHallucinations.forEach((item, idx) => {
    fakeCouplets.push({
      id: `FAKE_GEN_${String(idx + 1).padStart(3, '0')}`,
      type: 'ai_hallucination',
      expected: item.expected || 'fake',
      text: item.text.trim().normalize('NFC'),
      base_kural_number: null,
      alteration_note: item.alteration
    });
  });

  misattributedVerses.forEach((item, idx) => {
    fakeCouplets.push({
      id: `FAKE_MIS_${String(idx + 1).padStart(3, '0')}`,
      type: 'misattributed_literature',
      expected: item.expected || 'fake',
      text: item.text.trim().normalize('NFC'),
      base_kural_number: null,
      alteration_note: item.alteration
    });
  });

  const evaluationPayload = {
    metadata: {
      title: "Tamil Hackathon 2026 Problem P15 Evaluation Benchmark",
      description: "50 Authentic Tirukkural Couplets + 50 Fabricated/Altered/Misattributed verses for AI Hallucination Shield evaluation.",
      total_samples: realCouplets.length + fakeCouplets.length,
      real_count: realCouplets.length,
      fake_count: fakeCouplets.length,
      generated_at: new Date().toISOString()
    },
    real: realCouplets,
    fake: fakeCouplets
  };

  fs.writeFileSync(TEST_FILE, JSON.stringify(evaluationPayload, null, 2), 'utf8');
  console.log(`✅ Evaluation dataset generated at ${TEST_FILE}`);
  console.log(`• Real Couplets: ${realCouplets.length}`);
  console.log(`• Fake Couplets: ${fakeCouplets.length}`);
}

if (require.main === module) {
  buildTestSet();
}

module.exports = { buildTestSet };
