import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  Sparkles,
  ArrowRight,
  BookOpen,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';

/**
 * Curated authentic Tamil Kural quiz bank (fill-in-the-blank & meaning questions)
 */
const CANONICAL_QUIZ_BANK = [
  {
    id: 1,
    kuralNo: 1,
    chapter: 'கடவுள் வாழ்த்து',
    question: 'அகர முதல எழுத்தெல்லாம் ஆதி ______ முதற்றே உலகு — இதில் விடுபட்ட சீர் எது?',
    options: ['பகவன்', 'இறைவன்', 'தலைவன்', 'அரசன்'],
    correctIndex: 0,
    line1: 'அகர முதல எழுத்தெல்லாம் ஆதி',
    line2: 'பகவன் முதற்றே உலகு',
    meaning: 'எழுத்துக்களுக்கு அகரம் முதன்மை; உலகிற்கு ஆதிபகவன் முதன்மை.'
  },
  {
    id: 2,
    kuralNo: 391,
    chapter: 'கல்வி',
    question: 'கற்க கசடறக் கற்பவை கற்றபின் ______ அதற்குத் தக — இதில் கோடிட்ட சொல் எது?',
    options: ['நிற்க', 'செல்க', 'வெல்க', 'சொல்க'],
    correctIndex: 0,
    line1: 'கற்க கசடறக் கற்பவை கற்றபின்',
    line2: 'நிற்க அதற்குத் தக',
    meaning: 'பிழையறக் கற்க வேண்டும்; கற்ற நெறியில் நின்று வாழ வேண்டும்.'
  },
  {
    id: 3,
    kuralNo: 396,
    chapter: 'கல்வி',
    question: 'தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக் ______ தூறும் அறிவு — இதில் விடுபட்ட சொல் எது?',
    options: ['கற்றனைத்', 'நற்றனைத்', 'உற்றனைத்', 'பெற்றனைத்'],
    correctIndex: 0,
    line1: 'தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக்',
    line2: 'கற்றனைத் தூறும் அறிவு',
    meaning: 'மணலில் தோண்டிய அளவு நீர் ஊறும்; கற்ற அளவு மக்களுக்கு அறிவு பெருகும்.'
  },
  {
    id: 4,
    kuralNo: 72,
    chapter: 'அன்புடைமை',
    question: 'அன்பிலார் எல்லாம் தமக்குரியர் அன்புடையார் ______ உரியர் பிறர்க்கு — இதில் வரும் சொல் எது?',
    options: ['என்பும்', 'அன்பும்', 'பொன்னும்', 'கண்ணும்'],
    correctIndex: 0,
    line1: 'அன்பிலார் எல்லாம் தமக்குரியர் அன்புடையார்',
    line2: 'என்பும் உரியர் பிறர்க்கு',
    meaning: 'அன்பு இல்லாதவர் எல்லாம் தமக்கே என்பர்; அன்புடையவர் எலும்பையும் பிறர்க்கு வழங்குவர்.'
  },
  {
    id: 5,
    kuralNo: 69,
    chapter: 'மக்கட்பேறு',
    question: 'ஈன்ற பொழுதின் பெரிதுவக்கும் தன்மகனைச் ______ எனக் கேட்ட தாய் — இதில் விடுபட்ட சொல் எது?',
    options: ['சான்றோன்', 'வீரன்', 'அறிஞன்', 'மன்னன்'],
    correctIndex: 0,
    line1: 'ஈன்ற பொழுதின் பெரிதுவக்கும் தன்மகனைச்',
    line2: 'சான்றோன் எனக் கேட்ட தாய்',
    meaning: 'தன் மகனைச் சான்றோன் எனப் பிறர் பாராட்டக் கேட்ட தாய், ஈன்ற பொழுதை விடப் பெரிதும் மகிழ்வாள்.'
  },
  {
    id: 6,
    kuralNo: 423,
    chapter: 'அறிவுடைமை',
    question: 'எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள் ______ காண்ப தறிவு — இதில் விடுபட்ட சொல் எது?',
    options: ['மெய்ப்பொருள்', 'நுண்பொருள்', 'நற்பொருள்', 'பெரும்பொருள்'],
    correctIndex: 0,
    line1: 'எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்',
    line2: 'மெய்ப்பொருள் காண்ப தறிவு',
    meaning: 'எவர் கூறக் கேட்டாலும், அப்பொருளின் உண்மை நிலையை ஆராய்ந்து காண்பதே அறிவு.'
  },
  {
    id: 7,
    kuralNo: 2,
    chapter: 'கடவுள் வாழ்த்து',
    question: 'கற்றதனால் ஆய பயனென்கொல் வாலறிவன் ______ தொழாஅர் எனின் — இதில் வரும் சொல் எது?',
    options: ['நற்றாள்', 'பொற்றாள்', 'முற்றாள்', 'அடிதாள்'],
    correctIndex: 0,
    line1: 'கற்றதனால் ஆய பயனென்கொல் வாலறிவன்',
    line2: 'நற்றாள் தொழாஅர் எனின்',
    meaning: 'தூய அறிவு வடிவான இறைவனின் திருவடிகளைத் தொழாவிட்டால் கற்ற கல்வியால் பயன் இல்லை.'
  },
  {
    id: 8,
    kuralNo: 10,
    chapter: 'கடவுள் வாழ்த்து',
    question: 'பிறவிப் பெருங்கடல் நீந்துவர் நீந்தார் ______ அடிசேரா தார் — இதில் விடுபட்ட சொல் எது?',
    options: ['இறைவன்', 'தலைவன்', 'அரசன்', 'குருவின்'],
    correctIndex: 0,
    line1: 'பிறவிப் பெருங்கடல் நீந்துவர் நீந்தார்',
    line2: 'இறைவன் அடிசேரா தார்',
    meaning: 'இறைவனின் திருவடிகளைப் பொருந்தியவர் பிறவிக்கடலைக் கடப்பர்; மற்றவர் கடக்க மாட்டார்.'
  },
  {
    id: 9,
    kuralNo: 291,
    chapter: 'வாய்மை',
    question: 'வாய்மை எனப்படுவது யாதெனின் யாதொன்றும் ______ இலாத சொலல் — இதில் வரும் சொல் எது?',
    options: ['தீமை', 'பொய்மை', 'வன்மை', 'இன்மை'],
    correctIndex: 0,
    line1: 'வாய்மை எனப்படுவது யாதெனின் யாதொன்றும்',
    line2: 'தீமை இலாத சொலல்',
    meaning: 'வாய்மை என்பது மற்றவருக்குச் சிறிதும் தீங்கு தராத சொற்களைப் பேசுவதாகும்.'
  },
  {
    id: 10,
    kuralNo: 314,
    chapter: 'இன்னா செய்யாமை',
    question: 'இன்னாசெய்தாரை ஒறுத்தலவர் நாண ______ செய்து விடல் — இதில் விடுபட்ட சொல் எது?',
    options: ['நன்னயம்', 'புன்னயம்', 'மெய்ந்நயம்', 'இன்பநயம்'],
    correctIndex: 0,
    line1: 'இன்னாசெய்தாரை ஒறுத்தலவர் நாண',
    line2: 'நன்னயம் செய்து விடல்',
    meaning: 'தீங்கு செய்தவரைத் தண்டிக்கும் வழி, அவர் வெட்கப்படும்படி அவருக்கு நன்மை செய்வதே.'
  }
];

export default function TamilVoiceQuiz({ lang = 'ta' }) {
  const [gameState, setGameState] = useState('start'); // 'start' | 'playing' | 'result'
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);

  // Voice Recognition states: 'ready' | 'recording' | 'processing' | 'captured' | 'error'
  const [micState, setMicState] = useState('ready');
  const isListening = micState === 'recording';
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedbackMsg, setVoiceFeedbackMsg] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // Keep a mutable ref to the active question to prevent stale closure bugs
  // Initialized to null — synced via useEffect below after currentQ is defined
  const currentQRef = useRef(null);


  // Clean and normalize Tamil text for speech matching
  const normalizeTamilSpeech = (text) => {
    if (!text) return '';
    return text
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
      .replace(/[.,;!?"'’‘“”«»()\[\]{}—–\-:/\\_`~*#@^+=<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  // Match voice transcript against options
  const handleVoiceMatch = (rawTranscript) => {
    const q = currentQRef.current;
    if (!q || isAnswerSubmitted) return;

    const transcript = normalizeTamilSpeech(rawTranscript);
    if (!transcript) return;

    let matchedIdx = -1;

    // 1. Direct match with option text
    q.options.forEach((opt, idx) => {
      const optClean = normalizeTamilSpeech(opt);
      if (transcript.includes(optClean) || optClean.includes(transcript)) {
        matchedIdx = idx;
      }
    });

    // 2. Tamil option letter matching: அ, ஆ, இ, ஈ
    if (matchedIdx === -1) {
      if (/\b(?:அ|ஆப்ஷன்\s*அ|விருப்பம்\s*அ)\b/i.test(transcript) || transcript === 'அ') matchedIdx = 0;
      else if (/\b(?:ஆ|ஆப்ஷன்\s*ஆ|விருப்பம்\s*ஆ)\b/i.test(transcript) || transcript === 'ஆ') matchedIdx = 1;
      else if (/\b(?:இ|ஆப்ஷன்\s*இ|விருப்பம்\s*இ)\b/i.test(transcript) || transcript === 'இ') matchedIdx = 2;
      else if (/\b(?:ஈ|ஆப்ஷன்\s*ஈ|விருப்பம்\s*ஈ)\b/i.test(transcript) || transcript === 'ஈ') matchedIdx = 3;
    }

    // 3. English option letter matching: A, B, C, D
    if (matchedIdx === -1) {
      if (/\b(?:a|option\s*a)\b/i.test(transcript)) matchedIdx = 0;
      else if (/\b(?:b|option\s*b)\b/i.test(transcript)) matchedIdx = 1;
      else if (/\b(?:c|option\s*c)\b/i.test(transcript)) matchedIdx = 2;
      else if (/\b(?:d|option\s*d)\b/i.test(transcript)) matchedIdx = 3;
    }

    // 4. Tamil and English number words / ordinals
    if (matchedIdx === -1) {
      if (/(?:ஒன்று|முதலாவது|முதல்|1|one|first)/i.test(transcript)) matchedIdx = 0;
      else if (/(?:இரண்டு|இரண்டாவது|2|two|second)/i.test(transcript)) matchedIdx = 1;
      else if (/(?:மூன்று|மூன்றாவது|3|three|third)/i.test(transcript)) matchedIdx = 2;
      else if (/(?:நான்கு|நான்காவது|4|four|fourth)/i.test(transcript)) matchedIdx = 3;
    }

    if (matchedIdx !== -1) {
      setSelectedOption(matchedIdx);
      setMicState('captured');
      setVoiceFeedbackMsg(`குரல் அடையாளம் காணப்பட்டது: "${q.options[matchedIdx]}" ✓ (விடையை சரிபார்த்து சமர்ப்பிக்கவும்)`);
    } else {
      setVoiceFeedbackMsg(`"${rawTranscript}" — பொருத்தமான விடை கிடைக்கவில்லை. மீண்டும் கூறவும் அல்லது தொடவும்.`);
    }
  };

  // Initialize Speech Recognition on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ta-IN'; // Tamil (India)
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setMicState('recording');
        setVoiceFeedbackMsg('பேசுங்கள்... உங்கள் குரல் கேட்கப்படுகிறது (Listening...)');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let newlyFinalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            newlyFinalized += (newlyFinalized ? ' ' : '') + text.trim();
          } else {
            interim += text;
          }
        }

        if (newlyFinalized) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + newlyFinalized;
        }

        const accumulated = (finalTranscriptRef.current + (interim ? (finalTranscriptRef.current ? ' ' : '') + interim : '')).trim();
        setVoiceTranscript(accumulated);

        if (accumulated) {
          handleVoiceMatch(accumulated);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error in quiz:', e.error);
        if (e.error === 'no-speech') return;
        setMicState('error');
        if (e.error === 'not-allowed') {
          setVoiceFeedbackMsg('ஒலிவாங்கி (Microphone) அனுமதி மறுக்கப்பட்டது. உலாவியின் அமைப்பில் அனுமதி வழங்கவும்.');
        } else {
          setVoiceFeedbackMsg(`குரல் அறிதல் பிழை: ${e.error}. கீழே உள்ள விடைகளை நேரடியாகத் தொடவும்.`);
        }
      };

      recognition.onend = () => {
        if (micState === 'recording') {
          setMicState('ready');
        }
      };

      recognitionRef.current = recognition;
    } catch {
      setVoiceSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // Shuffle questions and options for a fresh round
  const startQuiz = () => {
    const shuffledQ = [...CANONICAL_QUIZ_BANK].sort(() => 0.5 - Math.random()).slice(0, 10);
    const randomized = shuffledQ.map((q) => {
      const correctText = q.options[q.correctIndex];
      const shuffledOptions = [...q.options].sort(() => 0.5 - Math.random());
      const newCorrectIndex = shuffledOptions.indexOf(correctText);
      return {
        ...q,
        options: shuffledOptions,
        correctIndex: newCorrectIndex
      };
    });

    setQuestions(randomized);
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setUserAnswers([]);
    setVoiceTranscript('');
    setVoiceFeedbackMsg('');
    finalTranscriptRef.current = '';
    setMicState('ready');
    setGameState('playing');
  };

  const currentQ = questions[currentIndex];

  // Sync currentQRef with the current question (must be after currentQ is defined)
  useEffect(() => {
    currentQRef.current = currentQ;
  }, [currentQ]);

  const toggleVoiceInput = () => {
    if (!voiceSupported) {
      alert('உங்கள் உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. விடைகளை நேரடியாகத் தொட்டு தேர்வு செய்யவும்.');
      return;
    }

    if (micState === 'recording') {
      try {
        setMicState('processing');
        recognitionRef.current?.stop();
      } catch {}
      setTimeout(() => setMicState('ready'), 300);
    } else {
      setVoiceTranscript('');
      setVoiceFeedbackMsg('');
      finalTranscriptRef.current = '';
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Speech start error:', err);
        setMicState('error');
      }
    }
  };

  const submitAnswer = () => {
    if (selectedOption === null || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    const isCorrect = selectedOption === currentQ.correctIndex;

    if (isCorrect) {
      sounds.playCorrect?.();
      setScore((prev) => prev + 1);
    } else {
      sounds.playWrong?.();
    }

    setUserAnswers((prev) => [
      ...prev,
      {
        question: currentQ.question,
        selected: currentQ.options[selectedOption],
        correct: currentQ.options[currentQ.correctIndex],
        isCorrect,
        kuralNo: currentQ.kuralNo,
        line1: currentQ.line1,
        line2: currentQ.line2,
        meaning: currentQ.meaning
      }
    ]);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setVoiceTranscript('');
      setVoiceFeedbackMsg('');
    } else {
      // Quiz Finished
      setGameState('result');
      if (score >= 7) {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      }
    }
  };

  // Rank calculation based on score
  const getRank = (finalScore) => {
    if (finalScore >= 9) return { title: 'வள்ளுவர் முதன்மைக் காவலர் 👑', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    if (finalScore >= 7) return { title: 'செந்தமிழ்க் கண்காணிப்பாளர் ⭐', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    if (finalScore >= 4) return { title: 'குறள் துப்பறிவாளர் 🔍', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
    return { title: 'இளநிலைத் தமிழ்க் காவலர் 🛡️', badge: 'bg-stone-500/20 text-stone-300 border-stone-500/40' };
  };

  // ==========================================
  // VIEW 1: START SCREEN
  // ==========================================
  if (gameState === 'start') {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-3xl bg-[#0c1824]/90 backdrop-blur-2xl border border-amber-500/25 shadow-2xl p-6 sm:p-12 text-center text-stone-100 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-600 to-orange-500 mx-auto flex items-center justify-center shadow-lg shadow-orange-600/30">
          <Mic className="w-10 h-10 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-bold font-serif text-[#F6E7B4] tracking-tight">
            தமிழ் வினாடி வினா
          </h1>
          <p className="text-sm sm:text-base text-stone-300 max-w-xl mx-auto leading-relaxed">
            உங்கள் அறிவை சோதியுங்கள் - தமிழ் பேசுங்கள், கற்றுக்கொள்ளுங்கள்!
          </p>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left text-xs">
          <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-white/10 flex items-start gap-2.5">
            <span className="text-lg">🎙️</span>
            <div>
              <p className="font-bold text-amber-300">குரல் வழிப் பதில்</p>
              <p className="text-stone-400 text-[11px] mt-0.5">மைக்கைத் தொட்டு தமிழில் நேரடியாக விடையைக் கூறலாம்.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-white/10 flex items-start gap-2.5">
            <span className="text-lg">📝</span>
            <div>
              <p className="font-bold text-amber-300">கைமுறைத் தேர்வு</p>
              <p className="text-stone-400 text-[11px] mt-0.5">குரல் இல்லாவிட்டாலும் விரலால் தொட்டு விடையளிக்கலாம்.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-white/10 flex items-start gap-2.5">
            <span className="text-lg">🏆</span>
            <div>
              <p className="font-bold text-amber-300">உடனடி மதிப்பெண்</p>
              <p className="text-stone-400 text-[11px] mt-0.5">10 கேள்விகளுக்குப் பின் உங்கள் காவலர் பட்டத்தை அறியலாம்.</p>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="pt-4">
          <button
            onClick={startQuiz}
            type="button"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base sm:text-lg shadow-xl shadow-orange-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            <span>வினாடி வினாவைத் தொடங்கு</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE QUIZ PLAYING SCREEN
  // ==========================================
  if (gameState === 'playing' && currentQ) {
    const isCorrect = selectedOption === currentQ.correctIndex;

    return (
      <div className="w-full max-w-4xl mx-auto rounded-3xl bg-[#0c1824]/90 backdrop-blur-2xl border border-amber-500/25 shadow-2xl p-6 sm:p-10 text-stone-100 space-y-6">
        {/* Progress & Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              அதிகாரம்: {currentQ.chapter} • குறள் #{currentQ.kuralNo}
            </span>
            <p className="text-xs text-stone-400 mt-0.5">
              கேள்வி <span className="text-white font-bold">{currentIndex + 1}</span> / {questions.length}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              மதிப்பெண்: {score}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="py-2">
          <h2 className="text-lg sm:text-2xl font-bold font-serif text-[#F6E7B4] leading-snug">
            {currentQ.question}
          </h2>
        </div>

        {/* Voice Input Section */}
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isAnswerSubmitted}
              className={`p-3.5 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/40 ring-4 ring-rose-500/30'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-orange-600/30'
              } disabled:opacity-50`}
              title="குரலில் பதிலளிக்க அழுத்தவும்"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <div>
              <p className="text-xs sm:text-sm font-bold text-stone-200">
                {isListening ? 'கேட்கிறது... தமிழில் விடையைக் கூறுங்கள்' : 'குரலில் பதிலளிக்க மைக்-ஐ அழுத்தவும்'}
              </p>
              <p className="text-[11px] text-stone-400">
                {voiceFeedbackMsg || (voiceSupported ? 'எ.கா: விடையின் பெயரை நேரடியாகக் கூறலாம்' : 'குரல் அறிதல் ஆதரிக்கப்படவில்லை')}
              </p>
            </div>
          </div>

          {!voiceSupported && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              கீழே உள்ள விடைகளைத் தொடவும்
            </span>
          )}
        </div>

        {/* 4 Multiple-Choice Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isAnswerOptionCorrect = idx === currentQ.correctIndex;

            let cardStyle = 'bg-stone-900/60 border-white/10 text-stone-200 hover:bg-stone-800/80 hover:border-amber-500/40';

            if (isAnswerSubmitted) {
              if (isAnswerOptionCorrect) {
                cardStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold ring-2 ring-emerald-500/40';
              } else if (isSelected && !isAnswerOptionCorrect) {
                cardStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 line-through';
              } else {
                cardStyle = 'bg-stone-900/40 border-white/5 text-stone-500 opacity-60';
              }
            } else if (isSelected) {
              cardStyle = 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold ring-2 ring-amber-500/30';
            }

            const tamilLetters = ['அ', 'ஆ', 'இ', 'ஈ'];

            return (
              <button
                key={idx}
                type="button"
                disabled={isAnswerSubmitted}
                onClick={() => setSelectedOption(idx)}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${cardStyle} min-h-[56px]`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold font-serif shrink-0">
                    {tamilLetters[idx]}
                  </span>
                  <span className="text-sm sm:text-base font-serif font-bold">{opt}</span>
                </div>

                {isAnswerSubmitted && isAnswerOptionCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                {isAnswerSubmitted && isSelected && !isAnswerOptionCorrect && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback Section (After Submission) */}
        {isAnswerSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl border ${
              isCorrect ? 'bg-emerald-950/50 border-emerald-500/40' : 'bg-rose-950/50 border-rose-500/40'
            } space-y-2 text-xs sm:text-sm`}
          >
            <div className="flex items-center gap-2 font-bold">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">சரியான விடை! மிக நன்று!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">தவறான விடை! சரியான விடை: "{currentQ.options[currentQ.correctIndex]}"</span>
                </>
              )}
            </div>

            <div className="pt-1 text-stone-300 font-serif">
              <p className="font-bold text-amber-200">{currentQ.line1}</p>
              <p className="font-bold text-amber-200">{currentQ.line2}</p>
              <p className="text-[11px] text-stone-400 mt-1 italic">உரை: {currentQ.meaning}</p>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3">
          {!isAnswerSubmitted ? (
            <button
              type="button"
              onClick={submitAnswer}
              disabled={selectedOption === null}
              className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              பதிலைச் சமர்ப்பிக்கவும்
            </button>
          ) : (
            <button
              type="button"
              onClick={nextQuestion}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span>{currentIndex + 1 < questions.length ? 'அடுத்த கேள்வி' : 'மதிப்பெண்ணைக் காண்க'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: QUIZ RESULT SCREEN
  // ==========================================
  const rank = getRank(score);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-[#0c1824]/90 backdrop-blur-2xl border border-amber-500/25 shadow-2xl p-6 sm:p-12 text-center text-stone-100 space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-600 to-orange-500 mx-auto flex items-center justify-center shadow-lg shadow-orange-600/30">
        <Award className="w-10 h-10 text-white" />
      </div>

      <div className="space-y-1">
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border mb-2 ${rank.badge}`}>
          {rank.title}
        </span>
        <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#F6E7B4]">
          வினாடி வினா முடிந்தது!
        </h2>
        <p className="text-xs sm:text-sm text-stone-400">
          குரல் காவலன் வினாடி வினாவில் உங்கள் செயல்பாடு
        </p>
      </div>

      {/* Score Big Display */}
      <div className="p-6 rounded-3xl bg-stone-900/70 border border-white/10 max-w-xs mx-auto">
        <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">உங்கள் மதிப்பெண்</p>
        <p className="text-5xl sm:text-6xl font-bold text-amber-400 font-serif my-1">
          {score} <span className="text-2xl text-stone-500">/ 10</span>
        </p>
        <p className="text-xs text-stone-300">
          சரியான பதில்கள்: <strong className="text-emerald-400">{score}</strong> | தவறானவை: <strong className="text-rose-400">{10 - score}</strong>
        </p>
      </div>

      {/* Answers Summary Breakdown */}
      <div className="text-left space-y-2.5 max-h-60 overflow-y-auto pr-2 scrollbar-none">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">
          விடைகளின் சுருக்கம் (Summary of Answers):
        </p>
        {userAnswers.map((ans, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              ans.isCorrect ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-rose-950/40 border-rose-500/30'
            }`}
          >
            <div>
              <p className="font-bold text-stone-200">
                #{idx + 1}. குறள் {ans.kuralNo}: {ans.correct}
              </p>
              {!ans.isCorrect && (
                <p className="text-rose-300 text-[11px]">
                  நீங்கள் கூறியது: {ans.selected}
                </p>
              )}
            </div>
            {ans.isCorrect ? (
              <span className="text-emerald-400 font-bold shrink-0">✓ சரி</span>
            ) : (
              <span className="text-rose-400 font-bold shrink-0">✗ தவறு</span>
            )}
          </div>
        ))}
      </div>

      {/* Restart Button */}
      <div className="pt-4 flex items-center justify-center gap-3">
        <button
          onClick={startQuiz}
          type="button"
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base shadow-xl shadow-orange-600/30 inline-flex items-center gap-2 transition-all hover:scale-[1.02]"
        >
          <RotateCcw className="w-5 h-5" />
          <span>மீண்டும் விளையாடு</span>
        </button>
      </div>
    </div>
  );
}
