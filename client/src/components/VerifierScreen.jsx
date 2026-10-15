import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  Mic,
  Camera,
  ExternalLink,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { t } from '../utils/translations';
import { verifyCoupletLocal } from '../utils/localVerifier';
import ValluvarSeal from './ValluvarSeal';
import TrustGauge from './TrustGauge';
import DiffViewer from './DiffViewer';
import VenbaMeterBadge from './VenbaMeterBadge';
import { sounds } from '../utils/audio';

export default function VerifierScreen({ lang = 'ta' }) {
  const [inputText, setInputText] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef(null);

  const demoChips = [
    {
      type: 'real',
      label: t[lang].demo_real,
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு'
    },
    {
      type: 'subtle',
      label: t[lang].demo_subtle,
      text: 'கற்றதனால் ஆய பயனென்கொல் வாலறிவன்\nபொற்றாள் தொழாஅர் எனின்'
    },
    {
      type: 'fake',
      label: t[lang].demo_fake,
      text: 'காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்'
    }
  ];

  const handleVerify = async (textToVerify = inputText) => {
    const text = textToVerify.trim();
    if (!text) return;

    setIsVerifying(true);
    setResult(null);

    try {
      // Local zero-latency offline verification
      const res = await verifyCoupletLocal(text);
      setResult(res);

      // Sound feedback based on outcome
      if (res.status === 'verified') {
        sounds.playStamp();
        sounds.playCorrect();
      } else if (res.status === 'uncertain') {
        sounds.playStamp();
      } else {
        sounds.playStamp();
        sounds.playWrong();
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDemoClick = (text) => {
    setInputText(text);
    handleVerify(text);
  };

  // Web Speech API (ta-IN)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'ta' ? 'உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை.' : 'Speech Recognition not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ta-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev}\n${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // OCR with Tesseract.js
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('tam');
      const ret = await worker.recognize(file);
      await worker.terminate();

      if (ret.data && ret.data.text) {
        setInputText(ret.data.text.trim());
      }
    } catch (err) {
      console.error('OCR failed:', err);
      alert(lang === 'ta' ? 'படத்திலிருந்து எழுத்துகளைப் படிக்க முடியவில்லை.' : 'OCR failed to extract Tamil text.');
    } finally {
      setOcrLoading(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    const textToCopy = `MeyKural: ${result.verdict} (${result.confidence_percent}% match)\nInput: ${inputText}\nNearest: Kural #${result.nearest_kural?.number || result.kural?.number}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Kolam decorative header */}
      <div className="kolam-divider mb-4 opacity-50" />

      {/* Main Card with Palm-leaf Border */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl p-5 sm:p-8 shadow-parchment-card border border-parchment-300 dark:border-ink-800 relative overflow-hidden">
        {/* Palm-leaf background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-temple-turmeric/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-2xl mx-auto mb-6">
          <h2 className="text-xl sm:text-2xl font-bold font-tamilSerif text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2">
            <span>{t[lang].app_title}</span>
            <ShieldCheck className="w-6 h-6 text-temple-turmeric" />
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            {lang === 'ta'
              ? 'அசல் 1,330 திருக்குறள்களுடன் துல்லியமாக ஒப்பிட்டு சரிபார்க்கும் பொறிமுறை. யூகிக்காது; உண்மை மட்டுமே பகரும்.'
              : 'Zero-guesswork verification against the canonical 1,330 Tirukkural couplets. Detects AI hallucinations and altered words.'}
          </p>
        </div>

        {/* Input Box Area */}
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={3}
            placeholder={t[lang].verify_placeholder}
            className="w-full p-4 sm:p-5 rounded-2xl bg-parchment-50 dark:bg-stone-950/80 border-2 border-parchment-300 dark:border-stone-700 focus:border-temple-turmeric focus:ring-2 focus:ring-amber-500/20 font-tamilSerif text-base sm:text-lg leading-relaxed text-stone-900 dark:text-stone-100 placeholder-stone-400 resize-none transition-all shadow-inner"
          />

          {/* Action buttons embedded in textarea bottom */}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-200/50 dark:border-stone-800">
            {/* Left: Voice & OCR */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  isListening
                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
                title="Web Speech API (ta-IN)"
              >
                <Mic className="w-3.5 h-3.5 text-rose-600" />
                <span>{isListening ? t[lang].voice_listening : t[lang].voice_input}</span>
                <span className="text-[9px] px-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400">
                  {t[lang].needs_internet}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-temple-turmeric" />
                <span>{ocrLoading ? t[lang].ocr_processing : t[lang].ocr_camera}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Clear button if text */}
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setResult(null);
                }}
                className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                {lang === 'ta' ? 'அழி' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Demo Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-temple-turmeric" />
            {t[lang].demo_chips}
          </span>
          {demoChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleDemoClick(chip.text)}
              className="text-xs px-3 py-1.5 rounded-xl bg-parchment-200/90 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-temple-turmeric hover:text-white transition-all border border-parchment-300 dark:border-stone-700 active:scale-95 shadow-xs"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Big Verify Action Button */}
        <div className="mt-6">
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || !inputText.trim()}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-temple-turmeric to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-base shadow-lg shadow-amber-600/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{t[lang].verifying}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>{t[lang].btn_verify}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Result Display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white dark:bg-ink-900 rounded-3xl p-5 sm:p-8 shadow-parchment-card border border-parchment-300 dark:border-ink-800"
          >
            {/* Top Header: Seal & Gauge side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-center pb-6 border-b border-stone-200 dark:border-stone-800">
              {/* Signature Moment: Valluvar's Wax Seal Stamp */}
              <div className="flex flex-col items-center">
                <ValluvarSeal type={result.seal} confidence={result.confidence_percent} />
                <div className="text-center mt-3">
                  <h3 className="font-tamilSerif font-bold text-lg text-stone-900 dark:text-stone-100">
                    {lang === 'ta' ? result.verdict_ta : result.verdict}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mt-1">
                    {result.recommendation}
                  </p>
                </div>
              </div>

              {/* Animated Trust Gauge */}
              <div className="flex flex-col items-center">
                <TrustGauge
                  score={result.confidence_percent}
                  level={result.trust_gauge}
                  lang={lang}
                />
              </div>
            </div>

            {/* Venba Meter Breakdown */}
            <div className="mt-5">
              <VenbaMeterBadge meter={result.meter} lang={lang} />
            </div>

            {/* Side-by-Side Word Diff Highlighting */}
            <DiffViewer
              wordDiff={result.word_diff}
              canonicalKural={result.kural || result.nearest_kural}
              lang={lang}
            />

            {/* Authentic Couplet Details & Meanings */}
            {(result.kural || result.nearest_kural) && (
              <div className="mt-6 p-4 sm:p-6 rounded-2xl bg-parchment-100/70 dark:bg-stone-950/70 border border-parchment-300 dark:border-stone-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-temple-turmeric" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      {result.status === 'verified'
                        ? lang === 'ta'
                          ? 'அசல் குறள் விவரங்கள்'
                          : 'Canonical Couplet'
                        : lang === 'ta'
                        ? 'அருகிலுள்ள உண்மையான குறள்'
                        : 'Nearest Authentic Tirukkural'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
                    குறள் #{result.kural?.number || result.nearest_kural?.number}
                  </span>
                </div>

                {/* Two Centered Couplet Lines in Noto Serif Tamil */}
                <div className="text-center my-4 py-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs">
                  <div className="font-tamilSerif text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-50 leading-relaxed">
                    {result.kural?.line1 || result.nearest_kural?.line1}
                  </div>
                  <div className="font-tamilSerif text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-50 leading-relaxed mt-1">
                    {result.kural?.line2 || result.nearest_kural?.line2}
                  </div>
                </div>

                {/* Adhikaram & Section */}
                <div className="text-xs text-stone-600 dark:text-stone-400 mb-3 flex flex-wrap gap-2">
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {lang === 'ta' ? 'அதிகாரம்:' : 'Chapter:'}
                  </span>
                  <span>{result.kural?.chapter_name || result.nearest_kural?.chapter_name}</span>
                  <span>•</span>
                  <span>{result.kural?.chapter_translation || result.nearest_kural?.chapter_translation}</span>
                </div>

                {/* Meanings */}
                <div className="space-y-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 pt-2 border-t border-stone-200 dark:border-stone-800">
                  <p>
                    <strong className="text-stone-900 dark:text-stone-100 font-tamilSerif">
                      {lang === 'ta' ? 'மு. வரதராசனார் உரை:' : 'Mu. Varadarajanar Commentary:'}
                    </strong>{' '}
                    {result.kural?.meaning_mv || result.nearest_kural?.meaning_mv}
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-100 font-tamilSerif">
                      {lang === 'ta' ? 'சாலமன் பாப்பையா உரை:' : 'Solomon Pappaiah Commentary:'}
                    </strong>{' '}
                    {result.kural?.meaning_sp || result.nearest_kural?.meaning_sp}
                  </p>
                  <p className="italic text-stone-600 dark:text-stone-400">
                    <strong>English:</strong> {result.kural?.translation_en || result.nearest_kural?.translation_en}
                  </p>
                </div>
              </div>
            )}

            {/* Warning / Consult Expert for Uncertain */}
            {result.status === 'uncertain' && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{t[lang].consult_expert}</div>
                  <p className="mt-1 opacity-90">
                    {lang === 'ta'
                      ? 'AI உருவாக்கிய வரிகளில் சொற்கள் மெதுவாக மாற்றப்பட்டிருக்கலாம். மேற்கோள் பிழைகளைத் தவிர்க்க நம்பகமான தளத்தில் சரிபார்க்கவும்.'
                      : 'AI generated content may contain subtle word substitutions that distort traditional meaning. Verify against authoritative repositories.'}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Actions: Trusted Site Button & Share */}
            <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
              <a
                href={result.trusted_site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <span>{t[lang].check_trusted_site}</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={copyResult}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? (lang === 'ta' ? 'நகலெடுக்கப்பட்டது!' : 'Copied!') : (lang === 'ta' ? 'முடிவை நகலெடு' : 'Copy Verdict')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
