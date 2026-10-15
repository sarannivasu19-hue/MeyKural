import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Heart, Sparkles, Filter, CheckCircle, ChevronDown } from 'lucide-react';
import { t } from '../utils/translations';
import { getOfflineChapters, getOfflineKuralsByChapter, searchOfflineKurals } from '../utils/localVerifier';

export default function LibraryScreen({ lang = 'ta', onSelectForVerify }) {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [kurals, setKurals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loveOnly, setLoveOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChapters() {
      setLoading(true);
      const chs = await getOfflineChapters();
      setChapters(chs);
      const initialKurals = await getOfflineKuralsByChapter(1);
      setKurals(initialKurals);
      setLoading(false);
    }
    loadChapters();
  }, []);

  const handleChapterChange = async (chNum) => {
    setSelectedChapter(Number(chNum));
    setSearchQuery('');
    setSearchResults(null);
    const kList = await getOfflineKuralsByChapter(chNum);
    setKurals(kList);
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await searchOfflineKurals(q, { loveOnly });
    setSearchResults(res.results);
  };

  const handleLoveToggle = async () => {
    const nextState = !loveOnly;
    setLoveOnly(nextState);
    if (nextState) {
      // Pick first love chapter: 109
      handleChapterChange(109);
    } else {
      handleChapterChange(1);
    }
  };

  const filteredChapters = loveOnly
    ? chapters.filter((c) => c.number >= 109 && c.number <= 133)
    : chapters;

  const currentChapterObj = chapters.find((c) => c.number === selectedChapter);
  const displayKurals = searchResults !== null ? searchResults : kurals;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-tamilSerif text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2">
          <span>{t[lang].nav_library}</span>
          <BookOpen className="w-6 h-6 text-temple-turmeric" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
          {lang === 'ta'
            ? 'முழுமையான 1,330 திருக்குறள்கள், 133 அதிகாரங்கள் மற்றும் உரைகளுடன் (100% ஆஃப்லைன் வசதி)'
            : 'Explore all 1,330 couplets across 133 Adhikarams with full traditional commentaries (100% Offline).'}
        </p>
      </div>

      {/* Control Bar: Adhikaram Selector, Love Filter, Search */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl p-5 shadow-parchment-card border border-parchment-300 dark:border-ink-800 mb-6 space-y-4">
        {/* Top Controls: Dropdown & Love Chapters Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Adhikaram Selector */}
          <div className="flex-1 relative">
            <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">
              {t[lang].library_adhikaram_select}
            </label>
            <div className="relative">
              <select
                value={selectedChapter}
                onChange={(e) => handleChapterChange(e.target.value)}
                disabled={searchResults !== null}
                className="w-full py-2.5 px-3.5 pr-9 rounded-xl bg-parchment-50 dark:bg-stone-950 border border-parchment-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-tamilSerif text-sm font-semibold focus:border-temple-turmeric focus:ring-1 focus:ring-amber-500 appearance-none disabled:opacity-50"
              >
                {filteredChapters.map((ch) => (
                  <option key={ch.number} value={ch.number}>
                    {ch.number}. {ch.name} ({ch.translation})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Love Chapters Toggle (109 - 133) */}
          <div className="flex sm:self-end">
            <button
              onClick={handleLoveToggle}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                loveOnly
                  ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                  : 'bg-parchment-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-parchment-300 dark:border-stone-700 hover:bg-parchment-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${loveOnly ? 'fill-current' : 'text-rose-500'}`} />
              <span>{t[lang].library_love_filter}</span>
            </button>
          </div>
        </div>

        {/* Keyword & Meaning Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={t[lang].search_keyword_placeholder}
            className="w-full py-2 pl-10 pr-4 rounded-xl bg-parchment-50 dark:bg-stone-950 border border-parchment-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm placeholder-stone-400 focus:border-temple-turmeric focus:ring-1 focus:ring-amber-500 font-tamilSans"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              {lang === 'ta' ? 'அழி' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* Chapter Information Banner */}
      {searchResults === null && currentChapterObj && (
        <div className="bg-parchment-200/60 dark:bg-stone-900/60 border border-parchment-300 dark:border-stone-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200">
              {currentChapterObj.section_name} ({currentChapterObj.section_translation})
            </span>
            <h3 className="text-lg font-bold font-tamilSerif text-stone-900 dark:text-stone-100 mt-1">
              {currentChapterObj.number}. {currentChapterObj.name}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400">{currentChapterObj.translation}</p>
          </div>
          <div className="text-xs font-mono text-stone-500 dark:text-stone-400">
            குறள்கள் {currentChapterObj.start} - {currentChapterObj.end} (10 குறள்கள்)
          </div>
        </div>
      )}

      {/* Couplets List */}
      <div className="space-y-4">
        {displayKurals.map((k) => (
          <div
            key={k.number}
            className="bg-white dark:bg-ink-900 rounded-2xl p-5 shadow-sm border border-parchment-300 dark:border-ink-800 hover:border-amber-400 dark:hover:border-amber-600 transition-all"
          >
            {/* Header: Number & Action */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2 mb-3">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                குறள் #{k.number}
              </span>
              <button
                onClick={() => onSelectForVerify(`${k.line1}\n${k.line2}`)}
                className="text-xs font-semibold text-temple-turmeric hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1"
                title="Send to Verifier"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'சரிபார்க்க அனுப்பு' : 'Test in Verifier'}</span>
              </button>
            </div>

            {/* Couplet Lines */}
            <div className="text-center my-3 py-2 bg-parchment-50/50 dark:bg-stone-950/40 rounded-xl">
              <div className="font-tamilSerif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-50 leading-relaxed">
                {k.line1}
              </div>
              <div className="font-tamilSerif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-50 leading-relaxed mt-0.5">
                {k.line2}
              </div>
            </div>

            {/* Meanings */}
            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1.5 mt-3 pt-2 border-t border-stone-100 dark:border-stone-800">
              <p>
                <strong className="text-stone-800 dark:text-stone-200">
                  {lang === 'ta' ? 'மு.வ உரை:' : 'Mu.V:'}
                </strong>{' '}
                {k.meaning_mv}
              </p>
              <p>
                <strong className="text-stone-800 dark:text-stone-200">
                  {lang === 'ta' ? 'பாப்பையா உரை:' : 'Pappaiah:'}
                </strong>{' '}
                {k.meaning_sp}
              </p>
              <p className="italic text-stone-500 dark:text-stone-400">
                <strong>English:</strong> {k.translation_en}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
