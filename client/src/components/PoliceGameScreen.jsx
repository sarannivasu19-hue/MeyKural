import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Flame, Award, CheckCircle, XCircle, RotateCcw, Volume2, Shield, Sparkles } from 'lucide-react';
import { t } from '../utils/translations';
import { sounds } from '../utils/audio';

const GAME_QUESTIONS = [
  {
    text: "அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு",
    isReal: true,
    kuralNumber: 1,
    explanation: "அசல் குறள் #1: கடவுள் வாழ்த்து அதிகாரத்தின் முதல் குறள்."
  },
  {
    text: "காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்",
    isReal: false,
    kuralNumber: null,
    explanation: "AI போலி! 'கணினி' என்ற நவீன சொல் திருக்குறளில் கிடையாது."
  },
  {
    text: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக",
    isReal: true,
    kuralNumber: 391,
    explanation: "அசல் குறள் #391: கல்வி அதிகாரம்."
  },
  {
    text: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தகாத",
    isReal: false,
    kuralNumber: 391,
    explanation: "AI சொல் திரிபு! 'தக' என்பது 'தகாத' என மாற்றப்பட்டு அறம் தலைகீழாக்கப்பட்டது."
  },
  {
    text: "துப்பார்க்குத் துப்பாய துப்பாக்கித் துப்பார்க்குத்\nதுப்பாய தூஉம் மழை",
    isReal: true,
    kuralNumber: 12,
    explanation: "அசல் குறள் #12: வான்சிறப்பு அதிகாரம்."
  },
  {
    text: "அன்பும் அறனும் அறிவும் உடையார்க்குத்\nதுன்பம் ஒருபோதும் இல்லை",
    isReal: false,
    kuralNumber: null,
    explanation: "AI உருவாக்கிய போலி வெண்பா! வள்ளுவர் இப்படி ஒரு குறள் எழுதவில்லை."
  },
  {
    text: "எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்\nமெய்ப்பொருள் காண்ப தறிவு",
    isReal: true,
    kuralNumber: 423,
    explanation: "அசல் குறள் #423: அறிவுடைமை அதிகாரம்."
  },
  {
    text: "பொருளல் லவரைப் பொருளாகச் செய்யும்\nபொருளல்ல தில்லை காசு",
    isReal: false,
    kuralNumber: 751,
    explanation: "AI சொல் மாற்றம்! அசல் குறளின் 'பொருள்' என்ற சொல்லுக்குப் பதில் 'காசு' என மாற்றப்பட்டுள்ளது."
  },
  {
    text: "தீயினால் சுட்டபுண் உள்ளாறும் ஆறாதே\nநாவினால் சுட்ட வடு",
    isReal: true,
    kuralNumber: 129,
    explanation: "அசல் குறள் #129: அடக்கமுடைமை அதிகாரம்."
  },
  {
    text: "யாதும் ஊரே யாவரும் கேளிர் தீதும்\nநன்றும் பிறர்தர வாரா",
    isReal: false,
    kuralNumber: null,
    explanation: "புறநானூறு 192 (கணியன் பூங்குன்றனார்)! இது திருக்குறள் அல்ல."
  }
];

export default function PoliceGameScreen({ lang = 'ta' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [feedback, setFeedback] = useState(null); // { isCorrect: boolean, msg: string }
  const [gameOver, setGameOver] = useState(false);

  const currentQ = GAME_QUESTIONS[currentIndex];

  const getRank = (currentScore) => {
    if (currentScore >= 9) return { titleTa: 'வள்ளுவர் முதன்மைக் காவலர்', titleEn: 'Chief Guardian of Valluvar', icon: '👑' };
    if (currentScore >= 6) return { titleTa: 'செந்தமிழ்க் கண்காணிப்பாளர்', titleEn: 'Sangam Inspector', icon: '⭐' };
    if (currentScore >= 3) return { titleTa: 'துப்பறிவாளர்', titleEn: 'Literary Detective', icon: '🔍' };
    return { titleTa: 'இளநிலை காவலர்', titleEn: 'Junior Constable', icon: '🛡️' };
  };

  const handleAnswer = (userChoseReal) => {
    if (feedback !== null || gameOver) return;

    const isCorrect = userChoseReal === currentQ.isReal;

    if (isCorrect) {
      sounds.playCorrect();
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      if (newStreak % 3 === 0) {
        sounds.playStreak();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      }

      setFeedback({
        isCorrect: true,
        title: lang === 'ta' ? 'சரியான விடை!' : 'Correct Catch!',
        explanation: currentQ.explanation
      });
    } else {
      sounds.playWrong();
      setStreak(0);
      setFeedback({
        isCorrect: false,
        title: lang === 'ta' ? 'தவறான கணிப்பு!' : 'Missed Hallucination!',
        explanation: currentQ.explanation
      });
    }
  };

  const handleNext = () => {
    setFeedback(null);
    if (currentIndex + 1 < GAME_QUESTIONS.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setGameOver(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setFeedback(null);
    setGameOver(false);
  };

  const rank = getRank(score);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-tamilSerif text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2">
          <span>{t[lang].police_title}</span>
          <Flame className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
          {t[lang].police_desc}
        </p>
      </div>

      {/* Gamification Bar: Score, Streak, Badge */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl p-4 shadow-sm border border-parchment-300 dark:border-ink-800 flex items-center justify-between mb-6">
        {/* Score */}
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-stone-400">{t[lang].police_score}</span>
          <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {score}/{GAME_QUESTIONS.length}
          </div>
        </div>

        {/* Streak with Fire Animation */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-500 fill-amber-500 animate-bounce' : 'text-stone-400'}`} />
          <span className="text-xs font-bold font-mono">{streak} {lang === 'ta' ? 'தொடர்' : 'Streak'}</span>
        </div>

        {/* Badge Rank */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-stone-400">{lang === 'ta' ? 'பதவி' : 'Badge'}</span>
          <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1">
            <span>{rank.icon}</span>
            <span>{lang === 'ta' ? rank.titleTa : rank.titleEn}</span>
          </div>
        </div>
      </div>

      {/* Game Play Card */}
      {!gameOver ? (
        <motion.div
          key={currentIndex}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="bg-white dark:bg-ink-900 rounded-3xl p-6 sm:p-8 shadow-parchment-card border-2 border-parchment-300 dark:border-ink-800 relative"
        >
          {/* Question Counter */}
          <div className="text-xs font-bold text-stone-400 mb-4 flex items-center justify-between">
            <span>{lang === 'ta' ? 'கேள்வி' : 'Question'} {currentIndex + 1} / {GAME_QUESTIONS.length}</span>
            <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800">
              {lang === 'ta' ? 'அசலா? போலியா?' : 'Real or Fake?'}
            </span>
          </div>

          {/* The Verse to Evaluate */}
          <div className="my-6 py-6 px-4 bg-parchment-50/70 dark:bg-stone-950/80 rounded-2xl border border-parchment-300/80 dark:border-stone-800 text-center shadow-inner">
            <div className="font-tamilSerif text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 leading-relaxed whitespace-pre-line">
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
                <button
                  onClick={handleNext}
                  className="mt-3 w-full py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs"
                >
                  {lang === 'ta' ? 'அடுத்த குறள் ➔' : 'Next Couplet ➔'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real & Fake Buttons */}
          {!feedback && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAnswer(true)}
                className="py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
              >
                <CheckCircle className="w-6 h-6" />
                <span>{t[lang].police_real_btn}</span>
              </button>

              <button
                onClick={() => handleAnswer(false)}
                className="py-4 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-md shadow-rose-600/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
              >
                <XCircle className="w-6 h-6" />
                <span>{t[lang].police_fake_btn}</span>
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        /* Game Over Screen */
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-ink-900 rounded-3xl p-8 shadow-parchment-card border border-parchment-300 dark:border-ink-800 text-center"
        >
          <div className="text-4xl mb-2">{rank.icon}</div>
          <h3 className="text-2xl font-bold font-tamilSerif text-stone-900 dark:text-stone-100 mb-1">
            {lang === 'ta' ? 'விளையாட்டு முடிந்தது!' : 'Challenge Complete!'}
          </h3>
          <p className="text-xs text-stone-500 mb-6">
            {lang === 'ta' ? 'உங்கள் குறள் பாதுகாப்புத் திறன்:' : 'Final Evaluation Score:'}
          </p>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 max-w-xs mx-auto mb-6">
            <div className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-300">
              {score} / {GAME_QUESTIONS.length}
            </div>
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
              {lang === 'ta' ? rank.titleTa : rank.titleEn}
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-temple-turmeric text-white font-bold text-sm shadow-md hover:bg-amber-600 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'ta' ? 'மீண்டும் விளையாடு' : 'Play Again'}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
