import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  Volume2,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { initOfflineData, getOfflineChapters, getOfflineKuralsByChapter, searchOfflineKurals } from '../utils/localVerifier';

// Tamil numeral map ௧-௰
const TAMIL_NUM_MAP = {
  '௧': 1, '௨': 2, '௩': 3, '௪': 4, '௫': 5,
  '௬': 6, '௭': 7, '௮': 8, '௯': 9, '௰': 10,
  '௧௧': 11, '௧௨': 12, '௧௩': 13, '௧௪': 14, '௧௫': 15,
  '௧௬': 16, '௧௭': 17, '௧௮': 18, '௧௯': 19, '௨௰': 20
};

function parseTamilNumeral(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (TAMIL_NUM_MAP[trimmed]) return TAMIL_NUM_MAP[trimmed];
  // Composite: convert each digit char
  let result = 0;
  for (const ch of trimmed) {
    if (TAMIL_NUM_MAP[ch]) result = result * 10 + TAMIL_NUM_MAP[ch];
    else return null;
  }
  return result > 0 ? result : null;
}

function parseSmartQuery(query) {
  if (!query || !query.trim()) return null;
  const q = query.trim();

  // Pattern: "30 5" or "30வது அதிகாரம் 5வது குறள்" or "chapter 30 kural 5"
  // Pattern: "குறள் 295" or just "295"
  // Pattern: Tamil numerals ௩௰ ௫

  // Try: <adhikaram> <position> (two numbers)
  const twoNumMatch = q.match(/^(\d+)\s+(\d+)$/);
  if (twoNumMatch) {
    const adh = parseInt(twoNumMatch[1], 10);
    const pos = parseInt(twoNumMatch[2], 10);
    if (adh >= 1 && adh <= 133 && pos >= 1 && pos <= 10) {
      return { type: 'adhikaram_pos', adhikaram: adh, position: pos, globalNumber: (adh - 1) * 10 + pos };
    }
  }

  // Try: Tamil numerals <adh> <pos>
  const tamilTwo = q.match(/^([௧௨௩௪௫௬௭௮௯௰]{1,4})\s+([௧௨௩௪௫௬௭௮௯௰]{1,2})$/);
  if (tamilTwo) {
    const adh = parseTamilNumeral(tamilTwo[1]);
    const pos = parseTamilNumeral(tamilTwo[2]);
    if (adh && pos && adh >= 1 && adh <= 133 && pos >= 1 && pos <= 10) {
      return { type: 'adhikaram_pos', adhikaram: adh, position: pos, globalNumber: (adh - 1) * 10 + pos };
    }
  }

  // Try: "30வது அதிகாரம் 5வது குறள்"
  const tamilDesc = q.match(/(\d+|[௧-௰]{1,3})வது\s*அதிகாரம்\s*(\d+|[௧-௰]{1,2})வது\s*குறள்/);
  if (tamilDesc) {
    const adh = /\d/.test(tamilDesc[1]) ? parseInt(tamilDesc[1], 10) : parseTamilNumeral(tamilDesc[1]);
    const pos = /\d/.test(tamilDesc[2]) ? parseInt(tamilDesc[2], 10) : parseTamilNumeral(tamilDesc[2]);
    if (adh && pos && adh >= 1 && adh <= 133 && pos >= 1 && pos <= 10) {
      return { type: 'adhikaram_pos', adhikaram: adh, position: pos, globalNumber: (adh - 1) * 10 + pos };
    }
  }

  // Try: "chapter 30 kural 5" or "adhikaram 30 kural 5"
  const engDesc = q.match(/(?:chapter|adhikaram)\s+(\d+)\s+(?:kural|verse)\s+(\d+)/i);
  if (engDesc) {
    const adh = parseInt(engDesc[1], 10);
    const pos = parseInt(engDesc[2], 10);
    if (adh >= 1 && adh <= 133 && pos >= 1 && pos <= 10) {
      return { type: 'adhikaram_pos', adhikaram: adh, position: pos, globalNumber: (adh - 1) * 10 + pos };
    }
  }

  // Try: "குறள் 295" or "kural 295"
  const kuralNum = q.match(/(?:குறள்|kural)\s+(\d+)/i);
  if (kuralNum) {
    const n = parseInt(kuralNum[1], 10);
    if (n >= 1 && n <= 1330) return { type: 'global', globalNumber: n };
  }

  // Try: Just a single global number
  const singleNum = q.match(/^(\d+)$/);
  if (singleNum) {
    const n = parseInt(singleNum[1], 10);
    if (n >= 1 && n <= 1330) return { type: 'global', globalNumber: n };
    if (n >= 1 && n <= 133) return { type: 'adhikaram_only', adhikaram: n };
  }

  // Try: Single Tamil numeral
  const singleTamil = q.match(/^([௧-௰]{1,4})$/);
  if (singleTamil) {
    const n = parseTamilNumeral(singleTamil[1]);
    if (n && n >= 1 && n <= 1330) return { type: 'global', globalNumber: n };
  }

  return null;
}

const SECTIONS = [
  { id: 'all', ta: 'அனைத்தும்', en: 'All', range: [1, 133] },
  { id: 'arathu', ta: 'அறத்துப்பால்', en: 'Virtue (Aram)', range: [1, 38] },
  { id: 'porul', ta: 'பொருட்பால்', en: 'Wealth (Porul)', range: [39, 108] },
  { id: 'kamam', ta: 'காமத்துப்பால்', en: 'Love (Kamam)', range: [109, 133] }
];

export default function LibraryScreen({ lang = 'ta', onSelectForVerify }) {
  const [chapters, setChapters] = useState([]);
  const [activeSection, setActiveSection] = useState('all');
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [chapterKurals, setChapterKurals] = useState({});

  // Quick Find state
  const [quickAdh, setQuickAdh] = useState('');
  const [quickPos, setQuickPos] = useState('');
  const [quickGlobal, setQuickGlobal] = useState('');
  const [quickError, setQuickError] = useState('');
  const [foundKural, setFoundKural] = useState(null);
  const [foundKuralIdx, setFoundKuralIdx] = useState(null);
  const [allKurals, setAllKurals] = useState([]);

  // Smart Query
  const [smartQuery, setSmartQuery] = useState('');
  const [smartParsed, setSmartParsed] = useState(null);
  const [smartError, setSmartError] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedKural, setCopiedKural] = useState(null);
  const [loading, setLoading] = useState(true);
  const resultCardRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [chs, bundle] = await Promise.all([getOfflineChapters(), initOfflineData()]);
      setChapters(chs);
      setAllKurals(bundle?.kurals || []);
      setLoading(false);
    }
    loadData();
  }, []);

  // Sync Quick Find dropdowns with global number
  const handleAdhChange = (v) => {
    const adh = parseInt(v, 10);
    setQuickAdh(v);
    if (adh >= 1 && adh <= 133 && quickPos) {
      const pos = parseInt(quickPos, 10);
      if (pos >= 1 && pos <= 10) {
        setQuickGlobal(String((adh - 1) * 10 + pos));
      }
    }
    setQuickError('');
    setFoundKural(null);
  };

  const handlePosChange = (v) => {
    const pos = parseInt(v, 10);
    setQuickPos(v);
    if (quickAdh && pos >= 1 && pos <= 10) {
      const adh = parseInt(quickAdh, 10);
      if (adh >= 1 && adh <= 133) {
        setQuickGlobal(String((adh - 1) * 10 + pos));
      }
    }
    setQuickError('');
    setFoundKural(null);
  };

  const handleGlobalChange = (v) => {
    const n = parseInt(v, 10);
    setQuickGlobal(v);
    if (n >= 1 && n <= 1330) {
      const adh = Math.ceil(n / 10);
      const pos = ((n - 1) % 10) + 1;
      setQuickAdh(String(adh));
      setQuickPos(String(pos));
    }
    setQuickError('');
    setFoundKural(null);
  };

  const doQuickFind = useCallback(() => {
    const n = parseInt(quickGlobal, 10);
    if (!n || n < 1 || n > 1330) {
      setQuickError(lang === 'ta' ? 'குறள் எண் 1 முதல் 1330 வரை இருக்க வேண்டும்.' : 'Kural number must be between 1 and 1330.');
      return;
    }
    const k = allKurals.find((ku) => ku.number === n);
    if (k) {
      setFoundKural(k);
      setFoundKuralIdx(n - 1);
      setQuickError('');
      setTimeout(() => resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } else {
      setQuickError(lang === 'ta' ? 'குறள் தரவுத்தளத்தில் காணப்படவில்லை.' : 'Kural not found in database.');
    }
  }, [quickGlobal, allKurals, lang]);

  const doSmartQuery = useCallback(() => {
    const parsed = parseSmartQuery(smartQuery);
    if (!parsed) {
      setSmartError(lang === 'ta' ? 'புரியவில்லை. "30 5", "குறள் 295" அல்லது "30வது அதிகாரம் 5வது குறள்" என்று முயற்சிக்கவும்.' : 'Could not parse query. Try "30 5", "kural 295", or "chapter 30 kural 5".');
      setSmartParsed(null);
      return;
    }
    setSmartParsed(parsed);
    setSmartError('');
    const n = parsed.globalNumber;
    if (n) {
      const k = allKurals.find((ku) => ku.number === n);
      if (k) {
        setFoundKural(k);
        setFoundKuralIdx(n - 1);
        setQuickGlobal(String(n));
        const adh = Math.ceil(n / 10);
        const pos = ((n - 1) % 10) + 1;
        setQuickAdh(String(adh));
        setQuickPos(String(pos));
        setTimeout(() => resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
  }, [smartQuery, allKurals, lang]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await searchOfflineKurals(q, { limit: 30 });
    setSearchResults(res.results);
  };

  const navigateKural = (direction) => {
    if (!foundKural) return;
    const newIdx = foundKuralIdx + direction;
    if (newIdx < 0 || newIdx >= allKurals.length) return;
    const k = allKurals[newIdx];
    setFoundKural(k);
    setFoundKuralIdx(newIdx);
    setQuickGlobal(String(k.number));
    const adh = Math.ceil(k.number / 10);
    const pos = ((k.number - 1) % 10) + 1;
    setQuickAdh(String(adh));
    setQuickPos(String(pos));
  };

  const readAloud = (kural) => {
    if (!kural) return;
    window.speechSynthesis.cancel();
    const text = `${kural.line1} ${kural.line2}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ta-IN';
    utterance.rate = 0.8;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const copyKural = (k) => {
    navigator.clipboard.writeText(`${k.line1}\n${k.line2}`);
    setCopiedKural(k.number);
    setTimeout(() => setCopiedKural(null), 2000);
  };

  const toggleChapter = async (ch) => {
    if (expandedChapter === ch.number) {
      setExpandedChapter(null);
      return;
    }
    setExpandedChapter(ch.number);
    if (!chapterKurals[ch.number]) {
      const ks = await getOfflineKuralsByChapter(ch.number);
      setChapterKurals((prev) => ({ ...prev, [ch.number]: ks }));
    }
  };

  const filteredChapters = chapters.filter((c) => {
    const sec = SECTIONS.find((s) => s.id === activeSection);
    if (!sec || sec.id === 'all') return true;
    return c.number >= sec.range[0] && c.number <= sec.range[1];
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 font-sans">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-400" />
          <span>{lang === 'ta' ? 'குறள் நூலகம்' : 'Kural Library'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl mx-auto">
          {lang === 'ta'
            ? '1,330 குறள்கள் · 133 அதிகாரங்கள் · முழுமையான உரைகள் · 100% ஆஃப்லைன்'
            : 'All 1,330 Couplets · 133 Adhikarams · Full Commentaries · 100% Offline'}
        </p>
      </div>

      {/* QUICK FIND BAR */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 border border-white/10 shadow-2xl mb-4 space-y-3 text-stone-100">
        <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span>{lang === 'ta' ? 'விரைவு குறள் தேடல் (Quick Find)' : 'Quick Find'}</span>
        </div>

        {/* 3 selectors in a row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Adhikaram */}
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
              {lang === 'ta' ? 'அதிகாரம் (1-133)' : 'Adhikaram'}
            </label>
            <select
              value={quickAdh}
              onChange={(e) => handleAdhChange(e.target.value)}
              className="w-full py-2 px-2 rounded-xl bg-[#070C15] border border-stone-700/80 text-white text-xs font-semibold outline-none focus:border-orange-500"
            >
              <option value="">{lang === 'ta' ? 'தேர்ந்தெடு' : 'Select'}</option>
              {Array.from({ length: 133 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Position in adhikaram */}
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
              {lang === 'ta' ? 'குறள் (1-10)' : 'Pos in Adh'}
            </label>
            <select
              value={quickPos}
              onChange={(e) => handlePosChange(e.target.value)}
              className="w-full py-2 px-2 rounded-xl bg-[#070C15] border border-stone-700/80 text-white text-xs font-semibold outline-none focus:border-orange-500"
            >
              <option value="">{lang === 'ta' ? 'தேர்ந்தெடு' : 'Select'}</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Global kural number */}
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
              {lang === 'ta' ? 'குறள் எண் (1-1330)' : 'Kural No.'}
            </label>
            <input
              type="number"
              min="1"
              max="1330"
              value={quickGlobal}
              onChange={(e) => handleGlobalChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doQuickFind()}
              placeholder={lang === 'ta' ? 'எ.கா: 295' : 'e.g. 295'}
              className="w-full py-2 px-2 rounded-xl bg-[#070C15] border border-stone-700/80 text-white text-xs font-semibold outline-none focus:border-orange-500"
            />
            <p className="text-[9px] text-stone-400 mt-0.5">
              {quickAdh && quickPos ? `(${quickAdh}-1)×10+${quickPos}=${quickGlobal}` : lang === 'ta' ? 'சூத்திரம்: (அதி-1)×10+நிலை' : 'Formula: (adh-1)×10+pos'}
            </p>
          </div>
        </div>

        <button
          onClick={doQuickFind}
          disabled={!quickGlobal}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          <Search className="w-4 h-4 inline-block mr-2" />
          {lang === 'ta' ? 'குறளைக் காட்டு' : 'Show Kural'}
        </button>

        {quickError && (
          <p className="text-xs text-rose-400 font-semibold">{quickError}</p>
        )}

        {/* Smart Query Box */}
        <div className="border-t border-white/10 pt-3">
          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">
            {lang === 'ta' ? 'அறிவார்ந்த தேடல் (Smart Query)' : 'Smart Text Query'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={smartQuery}
              onChange={(e) => { setSmartQuery(e.target.value); setSmartError(''); setSmartParsed(null); }}
              onKeyDown={(e) => e.key === 'Enter' && doSmartQuery()}
              placeholder={lang === 'ta' ? '"30 5" அல்லது "குறள் 295" அல்லது "30வது அதிகாரம் 5வது குறள்"' : '"30 5" or "kural 295" or "chapter 30 kural 5"'}
              className="flex-1 py-2 px-3 rounded-xl bg-[#070C15] border border-stone-700/80 text-white text-xs font-medium outline-none focus:border-orange-500 placeholder:text-stone-500"
            />
            <button
              onClick={doSmartQuery}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/10 transition-all"
            >
              {lang === 'ta' ? 'தேடு' : 'Find'}
            </button>
          </div>

          {smartParsed && (
            <p className="text-[11px] text-amber-300 mt-1 font-mono">
              ✓ {lang === 'ta' ? 'புரிந்தது:' : 'Parsed:'} {
                smartParsed.type === 'adhikaram_pos'
                  ? `${lang === 'ta' ? 'அதிகாரம்' : 'Adhikaram'} ${smartParsed.adhikaram}, ${lang === 'ta' ? 'நிலை' : 'Pos'} ${smartParsed.position} → ${lang === 'ta' ? 'குறள்' : 'Kural'} #${smartParsed.globalNumber}`
                  : `${lang === 'ta' ? 'குறள் எண்' : 'Kural #'}${smartParsed.globalNumber}`
              }
            </p>
          )}
          {smartError && (
            <p className="text-[11px] text-rose-400 mt-1">{smartError}</p>
          )}
        </div>
      </div>

      {/* Found Kural Result Card */}
      {foundKural && (
        <div ref={resultCardRef} className="bg-[#0D1522]/95 backdrop-blur-2xl rounded-3xl border border-orange-500/40 shadow-2xl p-5 sm:p-6 mb-5 text-stone-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 font-mono">
              {lang === 'ta' ? 'குறள்' : 'Kural'} #{foundKural.number}
            </span>
            <span className="text-xs text-stone-400">
              {foundKural.chapter_name} ({foundKural.section_name})
            </span>
          </div>

          {/* Kural lines */}
          <div className="text-center py-4 px-3 bg-[#070C15]/80 border border-white/10 rounded-2xl mb-4">
            <div className="font-serif text-base sm:text-xl font-bold text-white leading-relaxed">
              {foundKural.line1}
            </div>
            <div className="font-serif text-base sm:text-xl font-bold text-white leading-relaxed mt-0.5">
              {foundKural.line2}
            </div>
          </div>

          {/* Meanings */}
          <div className="text-xs text-stone-300 space-y-1.5 mb-4 leading-relaxed">
            <p><strong className="text-orange-400">{lang === 'ta' ? 'மு.வ உரை:' : 'Mu.Va:'}</strong> {foundKural.meaning_mv}</p>
            <p><strong className="text-amber-400">{lang === 'ta' ? 'பாப்பையா உரை:' : 'Pappaiah:'}</strong> {foundKural.meaning_sp}</p>
            <p className="italic text-stone-400"><strong>English:</strong> {foundKural.translation_en}</p>
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
            {/* Prev/Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateKural(-1)}
                disabled={foundKuralIdx <= 0}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition-all disabled:opacity-40 active:scale-95"
                title={lang === 'ta' ? 'முந்தைய குறள்' : 'Previous Kural'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-stone-400">{foundKuralIdx + 1} / 1330</span>
              <button
                onClick={() => navigateKural(1)}
                disabled={foundKuralIdx >= 1329}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition-all disabled:opacity-40 active:scale-95"
                title={lang === 'ta' ? 'அடுத்த குறள்' : 'Next Kural'}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Copy, Read Aloud, Verify */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyKural(foundKural)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition-all active:scale-95"
                title={lang === 'ta' ? 'நகலெடு' : 'Copy'}
              >
                {copiedKural === foundKural.number ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={() => readAloud(foundKural)}
                disabled={isSpeaking}
                className={`p-2 rounded-xl transition-all active:scale-95 border border-white/10 ${isSpeaking ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-stone-300'}`}
                title={lang === 'ta' ? 'தமிழில் படி' : 'Read Aloud (Tamil)'}
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {onSelectForVerify && (
                <button
                  onClick={() => onSelectForVerify(`${foundKural.line1}\n${foundKural.line2}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-orange-500/20 flex items-center"
                >
                  <Sparkles className="w-3.5 h-3.5 inline-block mr-1" />
                  <span>{lang === 'ta' ? 'சரிபார் அனுப்பு' : 'Send to Verifier'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-2xl p-3 sm:p-4 border border-white/10 mb-4 shadow-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={lang === 'ta' ? 'சொல் அல்லது பொருள் தேட...' : 'Search by word or meaning...'}
            className="w-full py-2 pl-10 pr-8 rounded-xl bg-[#070C15] border border-stone-700/80 text-white placeholder:text-stone-500 text-sm font-medium outline-none focus:border-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              className="absolute right-3 top-2.5 text-stone-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults !== null && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-stone-300">
              {lang === 'ta' ? `தேடல் முடிவுகள்: ${searchResults.length} குறள்கள்` : `Search Results: ${searchResults.length} kurals`}
            </h4>
          </div>
          <div className="space-y-3">
            {searchResults.map((k) => (
              <KuralCard key={k.number} kural={k} lang={lang} onSelectForVerify={onSelectForVerify} onCopy={copyKural} copiedKural={copiedKural} onReadAloud={readAloud} isSpeaking={isSpeaking} />
            ))}
          </div>
        </div>
      )}

      {/* Section Tabs */}
      {searchResults === null && (
        <>
          <div className="flex bg-[#070C15]/80 border border-white/10 p-1 rounded-2xl mb-4 overflow-x-auto gap-1">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex-1 min-w-max py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  activeSection === sec.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {lang === 'ta' ? sec.ta : sec.en}
              </button>
            ))}
          </div>

          {/* Adhikaram Accordion List */}
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-[#0D1522]/80 border border-white/10" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredChapters.map((ch) => (
                <div key={ch.number} className="rounded-2xl border border-white/10 bg-[#0D1522]/90 backdrop-blur-xl overflow-hidden shadow-lg">
                  {/* Chapter Header */}
                  <button
                    onClick={() => toggleChapter(ch)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300">
                        {ch.number}
                      </span>
                      <div>
                        <span className="font-bold text-sm text-white">{ch.name}</span>
                        <span className="text-xs text-stone-400 ml-2">({ch.translation})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-stone-400 font-mono">
                        {ch.start}-{ch.end}
                      </span>
                      {expandedChapter === ch.number
                        ? <ChevronUp className="w-4 h-4 text-orange-400" />
                        : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </button>

                  {/* Expanded Kurals */}
                  {expandedChapter === ch.number && (
                    <div className="border-t border-white/10 divide-y divide-white/5 bg-[#070C15]/90">
                      {chapterKurals[ch.number]?.map((k) => (
                        <div key={k.number} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-orange-400 font-mono">
                              #{k.number}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => copyKural(k)}
                                className="p-1 rounded-lg text-stone-400 hover:text-white transition-colors"
                              >
                                {copiedKural === k.number ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => readAloud(k)}
                                className={`p-1 rounded-lg transition-colors ${isSpeaking ? 'text-orange-400' : 'text-stone-400 hover:text-white'}`}
                              >
                                <Volume2 className="w-3 h-3" />
                              </button>
                              {onSelectForVerify && (
                                <button
                                  onClick={() => onSelectForVerify(`${k.line1}\n${k.line2}`)}
                                  className="text-[10px] px-2.5 py-0.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold transition-colors"
                                >
                                  {lang === 'ta' ? 'சரிபார்' : 'Verify'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="font-serif text-sm font-bold text-white leading-relaxed">{k.line1}</div>
                          <div className="font-serif text-sm font-bold text-white leading-relaxed">{k.line2}</div>
                          <div className="text-xs text-stone-300 mt-1 leading-relaxed">{k.meaning_mv}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KuralCard({ kural: k, lang, onSelectForVerify, onCopy, copiedKural, onReadAloud, isSpeaking }) {
  return (
    <div className="bg-[#0D1522]/90 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-orange-500/50 shadow-xl transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
          #{k.number}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onCopy(k)} className="p-1.5 rounded-lg text-stone-400 hover:text-white transition-colors">
            {copiedKural === k.number ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onReadAloud(k)} className={`p-1.5 rounded-lg ${isSpeaking ? 'text-orange-400' : 'text-stone-400 hover:text-white transition-colors'}`}>
            <Volume2 className="w-3.5 h-3.5" />
          </button>
          {onSelectForVerify && (
            <button
              onClick={() => onSelectForVerify(`${k.line1}\n${k.line2}`)}
              className="text-[10px] px-2.5 py-0.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold transition-colors"
            >
              {lang === 'ta' ? 'சரிபார்' : 'Verify'}
            </button>
          )}
        </div>
      </div>
      <div className="font-serif font-bold text-white text-sm leading-relaxed">{k.line1}</div>
      <div className="font-serif font-bold text-white text-sm leading-relaxed">{k.line2}</div>
      <div className="text-xs text-stone-300 mt-1.5 leading-relaxed">{k.meaning_mv}</div>
    </div>
  );
}
