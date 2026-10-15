import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  BookOpen,
  HelpCircle,
  User,
  BarChart3,
  Award,
  Sparkles,
  ChevronRight,
  Star
} from 'lucide-react';
import { APP_CONFIG } from '../config';

const DAILY_KURAL_KEY = 'tkk_daily_kural';
const DAILY_DATE_KEY = 'tkk_daily_date';

// Refined, darker menu items matching reference image
const features = [
  {
    id: 'verify',
    icon: CheckSquare,
    color: 'from-orange-500 to-amber-600',
    ta: 'சரிபார்ப்பு',
    en: 'Verifier',
    descTa: 'குறளின் நம்பகத்தன்மையை சரிபார்க்க',
    descEn: 'Verify Thirukkural authenticity'
  },
  {
    id: 'library',
    icon: BookOpen,
    color: 'from-amber-600 to-orange-700',
    ta: 'நூலகம்',
    en: 'Library',
    descTa: 'தமிழ் இலக்கியங்கள் மற்றும் 1,330 குறள்கள்',
    descEn: 'Browse all 1,330 couplets'
  },
  {
    id: 'police',
    icon: HelpCircle,
    color: 'from-orange-600 to-rose-600',
    ta: 'தமிழ் வினாடி வினா',
    en: 'Tamil Quiz',
    descTa: 'குரல் வழியில் வினாடி வினா விளையாடுங்கள்',
    descEn: 'Interactive voice-enabled Tamil quiz'
  },
  {
    id: 'chat',
    icon: User,
    color: 'from-yellow-600 to-amber-700',
    ta: 'திருவள்ளுவர்',
    en: 'Thiruvalluvar',
    descTa: 'தமிழின் மெய்ப்பொருள் உலகறிந்த ஞானம்',
    descEn: 'Strict Canonical AI literary assistant'
  },
  {
    id: 'ai_report',
    icon: BarChart3,
    color: 'from-orange-500 to-red-600',
    ta: 'அறிக்கை',
    en: 'Report',
    descTa: 'செயல்திறன் மற்றும் முன்னேற்ற அறிக்கை',
    descEn: 'Hallucination rates and analytics'
  },
  {
    id: 'eval',
    icon: Award,
    color: 'from-amber-500 to-yellow-600',
    ta: 'மதிப்பெண்',
    en: 'Scorecard',
    descTa: '100 மாதிரி நம்பகத்தன்மை மதிப்பீடு',
    descEn: '100-sample verification accuracy'
  }
];

export default function HomeScreen({ lang = 'ta', setActiveTab, user }) {
  const [dailyKural, setDailyKural] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cachedDate = localStorage.getItem(DAILY_DATE_KEY);
    const cachedKural = localStorage.getItem(DAILY_KURAL_KEY);
    if (cachedDate === today && cachedKural) {
      try {
        setDailyKural(JSON.parse(cachedKural));
        setLoading(false);
        return;
      } catch {}
    }
    const start = new Date(new Date().getFullYear(), 0, 0);
    const dayOfYear = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
    const kuralNum = (dayOfYear % 1330) + 1;
    fetch('/api/kurals/' + kuralNum)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.number) {
          setDailyKural(data);
          localStorage.setItem(DAILY_DATE_KEY, today);
          localStorage.setItem(DAILY_KURAL_KEY, JSON.stringify(data));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  const itemV = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-6 pb-6 font-sans">
      {/* HERO SECTION - MATCHING PANEL 1 IN REFERENCE IMAGE */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-[#09111D]/90 border border-white/10 p-8 sm:p-10 shadow-2xl backdrop-blur-xl"
      >
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight font-tamilSerif">
            {lang === 'ta' ? 'தமிழின் செம்மொழி' : 'Classical Tamil'}
          </h1>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mt-1 leading-tight font-tamilSerif">
            {lang === 'ta' ? 'இன்றும் என்றும்...' : 'Timeless & Eternal...'}
          </h2>
          <p className="text-stone-300 text-sm sm:text-base mt-4 leading-relaxed font-sans max-w-md">
            {lang === 'ta'
              ? 'AI உதவியுடன் தமிழ் அறிவை மேம்படுத்துவோம்.'
              : 'Empowering Tamil wisdom and literature with canonical AI shielding.'}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setActiveTab('verify')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-lg shadow-orange-500/30 transition-all active:scale-95 flex items-center gap-2"
            >
              <span>{lang === 'ta' ? 'சரிபார்க்கத் தொடங்கு' : 'Start Verification'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('police')}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 border border-white/10 font-bold text-sm transition-all"
            >
              <span>{lang === 'ta' ? 'தமிழ் வினாடி வினா' : 'Tamil Quiz'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* TODAY'S KURAL CARD - REFINED DARK STYLING */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/10 bg-[#09111D]/85 backdrop-blur-xl p-6 shadow-xl text-stone-100"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold text-stone-200 font-sans">
              {lang === 'ta' ? 'இன்றைய குறள்' : "Today's Kural"}
            </h2>
          </div>
          {dailyKural && (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-mono">
              #{dailyKural.number}
            </span>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2 py-2">
            <div className="h-4 bg-stone-700/50 rounded w-3/4" />
            <div className="h-4 bg-stone-700/50 rounded w-2/3" />
          </div>
        ) : dailyKural ? (
          <div>
            <p className="text-base sm:text-lg font-serif font-bold text-white leading-relaxed mb-1">
              {dailyKural.line1}
            </p>
            <p className="text-base sm:text-lg font-serif font-bold text-white leading-relaxed mb-3">
              {dailyKural.line2}
            </p>
            {dailyKural.chapter_name && (
              <p className="text-xs text-orange-400 font-semibold mb-1">
                {lang === 'ta' ? 'அதிகாரம்: ' + dailyKural.chapter_name : 'Chapter: ' + dailyKural.chapter_translation}
              </p>
            )}
            <p className="text-xs text-stone-300 leading-relaxed">
              {lang === 'ta' ? dailyKural.meaning_mv || dailyKural.meaning_sp : dailyKural.translation_en}
            </p>
          </div>
        ) : null}
      </motion.section>

      {/* 5. DARKENED HOME PAGE MENU ITEMS - MATCHING REFERENCE IMAGE */}
      <div>
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">
          {lang === 'ta' ? 'முக்கிய பிரிவுகள்' : 'Features'}
        </h2>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.button
                key={f.id}
                variants={itemV}
                onClick={() => setActiveTab(f.id)}
                className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-[#09111D]/90 hover:bg-[#111C2E]/95 border border-white/10 hover:border-orange-500/50 backdrop-blur-xl shadow-xl hover:shadow-orange-500/10 text-left transition-all duration-200 min-h-[110px]"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-bold text-white group-hover:text-orange-300 transition-colors">
                    {lang === 'ta' ? f.ta : f.en}
                  </p>
                  <p className="text-xs text-stone-300 mt-0.5 leading-snug line-clamp-2">
                    {lang === 'ta' ? f.descTa : f.descEn}
                  </p>
                </div>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
