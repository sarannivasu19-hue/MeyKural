import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Flame, Award, CheckCircle, XCircle, RotateCcw, Shield, Sparkles, Trophy, BookOpen, Mic } from 'lucide-react';
import { t } from '../utils/translations';
import { sounds } from '../utils/audio';
import { initOfflineData } from '../utils/localVerifier';
import { generateGameRound } from '../utils/gameGenerator';
import TamilVoiceQuiz from './TamilVoiceQuiz';

const LEADERBOARD_KEY = 'kural_police_leaderboard';

export default function PoliceGameScreen({ lang = 'ta' }) {
  const [activeMode, setActiveMode] = useState('quiz'); // 'quiz' | 'police'
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // Load leaderboard from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEADERBOARD_KEY);
      if (saved) setLeaderboard(JSON.parse(saved));
    } catch {}
  }, []);

  // Initialize round
  const startNewRound = async () => {
    setLoading(true);
    setGameOver(false);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setFeedback(null);

    try {
      const bundle = await initOfflineData();
      if (bundle && bundle.kurals) {
        const round = generateGameRound(bundle.kurals);
        setQuestions(round);
      }
    } catch (err) {
      console.error('Failed to load game round:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startNewRound();
  }, []);

  const getRank = (currentScore) => {
    if (currentScore >= 9) return { titleTa: 'வள்ளுவர் முதன்மைக் காவலர்', titleEn: 'Chief Guardian of Valluvar', icon: '👑' };
    if (currentScore >= 6) return { titleTa: 'செந்தமிழ்க் கண்காணிப்பாளர்', titleEn: 'Sangam Inspector', icon: '⭐' };
    if (currentScore >= 3) return { titleTa: 'துப்பறிவாளர்', titleEn: 'Literary Detective', icon: '🔍' };
    return { titleTa: 'இளநிலை காவலர்', titleEn: 'Junior Constable', icon: '🛡️' };
  };

  const currentQ = questions[currentIndex];

  const handleAnswer = (userChoseReal) => {
    if (feedback !== null || gameOver || !currentQ) return;

    const isCorrect = userChoseReal === currentQ.isReal;

    if (isCorrect) {
      sounds.playCorrect?.();
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      if (newStreak % 3 === 0) {
        sounds.playStreak?.();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      }

      setFeedback({
        isCorrect: true,
        title: lang === 'ta' ? 'சரியான விடை!' : 'Correct Catch!',
        explanation: currentQ.explanation,
        changedWords: currentQ.changedWords,
        canonical: currentQ.canonicalKural
      });
    } else {
      sounds.playWrong?.();
      setStreak(0);
      setFeedback({
        isCorrect: false,
        title: lang === 'ta' ? 'தவறான கணிப்பு!' : 'Missed Hallucination!',
        explanation: currentQ.explanation,
        changedWords: currentQ.changedWords,
        canonical: currentQ.canonicalKural
      });
    }
  };

  const handleNext = () => {
    setFeedback(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setGameOver(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });

      // Save to local leaderboard
      const newEntry = {
        score,
        maxStreak,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updated = [newEntry, ...leaderboard].slice(0, 5);
      setLeaderboard(updated);
      try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  const rank = getRank(score);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center font-serif">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-stone-500">
          {lang === 'ta' ? '1,330 குறள்களிலிருந்து புதிய சுற்று உருவாக்கப்படுகிறது...' : 'Generating 10 fresh kurals from 1,330 couplets...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 font-sans">
      {/* Segmented Mode Switcher */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex rounded-2xl bg-[#0c1824]/90 p-1.5 border border-amber-500/30 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveMode('quiz')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
              activeMode === 'quiz'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-600/30 scale-[1.02]'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-4 h-4 text-amber-300" />
            <span>{lang === 'ta' ? 'தமிழ் வினாடி வினா' : 'Tamil Voice Quiz'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('police')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
              activeMode === 'police'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-600/30 scale-[1.02]'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-300" />
            <span>{lang === 'ta' ? 'குறள் காவலன் வேட்டை' : 'Kural Police Game'}</span>
          </button>
        </div>
      </div>

      {/* Render Tamil Voice Quiz Mode */}
      {activeMode === 'quiz' ? (
        <TamilVoiceQuiz lang={lang} />
      ) : (
        /* Hallucination Police Game Mode */
        <div className="max-w-xl mx-auto font-serif">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-100 flex items-center justify-center gap-2">
              <span>{lang === 'ta' ? 'குறள் காவலர் விளையாட்டு' : 'Kural Police Game'}</span>
              <Flame className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 mt-1">
              {lang === 'ta'
                ? 'போலி AI குறள்களைக் கண்டறியுங்கள். ஒவ்வொரு சுற்றிலும் 10 முற்றிலும் புதிய குறள்கள்!'
                : 'Detect AI hallucinations and altered words. 10 fresh kurals every round!'}
            </p>
          </div>

      {/* Gamification Bar: Score, Streak, Progress */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 shadow-sm border border-stone-200 dark:border-stone-800 flex items-center justify-between mb-4">
        {/* Score */}
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-stone-400">
            {lang === 'ta' ? 'மதிப்பெண்' : 'Score'}
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {score}/{questions.length}
          </div>
        </div>

        {/* Streak with Fire Animation */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-500 fill-amber-500 animate-bounce' : 'text-stone-400'}`} />
          <span className="text-xs font-bold font-mono">{streak} {lang === 'ta' ? 'தொடர் வெற்றி' : 'Streak'}</span>
        </div>

        {/* Badge Rank */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-stone-400">
            {lang === 'ta' ? 'பதவி' : 'Badge'}
          </span>
          <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1">
            <span>{rank.icon}</span>
            <span>{lang === 'ta' ? rank.titleTa : rank.titleEn}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {!gameOver && questions.length > 0 && (
        <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden mb-6">
          <div
            className="bg-amber-600 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      )}

      {/* Game Play Card */}
      {!gameOver && currentQ ? (
        <motion.div
          key={currentIndex}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-stone-200 dark:border-stone-800 relative"
        >
          {/* Question Counter */}
          <div className="text-xs font-bold text-stone-400 mb-4 flex items-center justify-between">
            <span>{lang === 'ta' ? 'கேள்வி' : 'Question'} {currentIndex + 1} / {questions.length}</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-semibold">
              {lang === 'ta' ? 'அசலா? போலியா?' : 'Real or Fake?'}
            </span>
          </div>

          {/* The Verse to Evaluate */}
          <div className="my-6 py-6 px-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 text-center shadow-inner">
            <div className="font-serif text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 leading-kural whitespace-pre-line">
              "{currentQ.text}"
            </div>
          </div>

          {/* Feedback Overlay if Answered */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-4 rounded-2xl mb-6 border text-xs sm:text-sm ${
                  feedback.isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-base mb-1">
                  {feedback.isCorrect ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
                  <span>{feedback.title}</span>
                </div>
                <p className="opacity-95 leading-relaxed">{feedback.explanation}</p>

                {/* Highlight changed words if fake */}
                {feedback.changedWords && feedback.changedWords.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-black/40 border border-stone-300 dark:border-stone-700">
                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                      {lang === 'ta' ? 'மாற்றப்பட்ட சொல்:' : 'Altered Word:'}
                    </span>
                    {feedback.changedWords.map((cw, idx) => (
                      <div key={idx} className="flex items-center gap-2 font-bold text-xs">
                        <span className="line-through text-rose-600">{cw.fakeWord}</span>
                        <span>➔</span>
                        <span className="text-emerald-600">{cw.realWord}</span>
                        <span className="text-stone-400 text-[10px] font-normal">
                          ({lang === 'ta' ? 'அசல் சொல்' : 'Original'})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleNext}
                  className="mt-3 w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
                >
                  {currentIndex + 1 < questions.length
                    ? (lang === 'ta' ? 'அடுத்த குறள் ➔' : 'Next Couplet ➔')
                    : (lang === 'ta' ? 'முடிவுகளைப் பார் ➔' : 'View Results ➔')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real & Fake Buttons */}
          {!feedback && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAnswer(true)}
                className="py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-6 h-6" />
                <span>{lang === 'ta' ? 'அசல் குறள்' : 'Real Couplet'}</span>
              </button>

              <button
                onClick={() => handleAnswer(false)}
                className="py-4 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-md shadow-rose-600/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1.5"
              >
                <XCircle className="w-6 h-6" />
                <span>{lang === 'ta' ? 'போலி / மாற்றம்' : 'Fake / Altered'}</span>
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        /* Game Over Screen */
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 dark:border-stone-800 text-center"
        >
          <div className="text-5xl mb-2">{rank.icon}</div>
          <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-1">
            {lang === 'ta' ? 'சுற்று முடிந்தது!' : 'Round Complete!'}
          </h3>
          <p className="text-xs text-stone-500 mb-6">
            {lang === 'ta' ? 'உங்கள் இறுதி மதிப்பெண் & பதவி:' : 'Your final score & earned rank:'}
          </p>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 max-w-xs mx-auto mb-6">
            <div className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-300">
              {score} / {questions.length} ({Math.round((score / questions.length) * 100)}%)
            </div>
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
              {lang === 'ta' ? rank.titleTa : rank.titleEn}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {lang === 'ta' ? 'அதிகபட்ச தொடர் வெற்றி:' : 'Max Streak:'} {maxStreak}
            </div>
          </div>

          {/* Local Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-left">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ta' ? 'உள்ளூர் முன்னிலை பட்டியல்' : 'Local Leaderboard'}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {leaderboard.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-stone-100 dark:border-stone-800 last:border-0">
                    <span className="font-semibold text-stone-700 dark:text-stone-300">
                      #{idx + 1} • {item.score}/10 ({item.date} {item.time})
                    </span>
                    <span className="font-mono text-amber-600 font-bold">
                      {item.maxStreak} streak
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startNewRound}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'ta' ? 'புதிய சுற்று விளையாடு' : 'Play Again (New Set)'}</span>
          </button>
        </motion.div>
      )}
        </div>
      )}
    </div>
  );
}
