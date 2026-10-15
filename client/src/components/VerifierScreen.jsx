import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  Search,
  Sparkles,
  Mic,
  Camera,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Info,
  XCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { t } from '../utils/translations';
import { verifyCoupletLocal } from '../utils/localVerifier';
import { sounds } from '../utils/audio';
import { APP_CONFIG } from '../config';

const AI_SOURCES = [
  'Not from AI',
  'ChatGPT',
  'Gemini',
  'Claude',
  'Copilot',
  'Meta AI',
  'Grok',
  'DeepSeek',
  'Other'
];

export default function VerifierScreen({ lang = 'ta' }) {
  // Single continuous couplet text state containing both sections
  const [coupletText, setCoupletText] = useState(
    'அறத்தாறாங் கொல் உயர்வு\nஉலகத்தார்க்கு எல்லாம்\n\nபிறப்பொக்கும் எல்லா உயிர்க்கும்\nசிறப்பொவ்வா செய்தொழில் வேற்றுமை யான்.'
  );
  const [sourceAi, setSourceAi] = useState('Not from AI');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // File Upload & OCR states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [ocrError, setOcrError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Helper to split continuous text into Line 1 (first 4 words) and Line 2 (remaining 3 words)
  const parseCouplet = (text) => {
    if (!text || !text.trim()) return { line1: '', line2: '', line1Words: [], line2Words: [] };

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let l1 = '';
    let l2 = '';

    if (lines.length >= 2) {
      l1 = lines[0];
      l2 = lines.slice(1).join(' ');
    } else {
      const allWords = text.trim().split(/\s+/).filter(Boolean);
      if (allWords.length >= 7) {
        l1 = allWords.slice(0, 4).join(' ');
        l2 = allWords.slice(4).join(' ');
      } else if (allWords.length >= 4) {
        l1 = allWords.slice(0, 4).join(' ');
        l2 = allWords.slice(4).join(' ');
      } else {
        l1 = text.trim();
        l2 = '';
      }
    }

    const line1Words = (l1 || '').trim().split(/\s+/).filter(Boolean);
    const line2Words = (l2 || '').trim().split(/\s+/).filter(Boolean);

    return { line1: l1, line2: l2, line1Words, line2Words };
  };

  const { line1, line2, line1Words, line2Words } = parseCouplet(coupletText);
  const totalWords = line1Words.length + line2Words.length;
  const isLine1Valid = line1Words.length === 4;
  const isLine2Valid = line2Words.length === 3;
  const canVerify = (isLine1Valid && isLine2Valid) || totalWords === 7 || (line1 && line2);

  // Quick Demo chips
  const demoChips = [
    {
      type: 'real',
      label: lang === 'ta' ? 'அசல் (Verified)' : 'Authentic Couplet',
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு'
    },
    {
      type: 'sample',
      label: lang === 'ta' ? 'அறம் (Verified)' : 'Sample Couplet',
      text: 'அறத்தாறாங் கொல் உயர்வு\nஉலகத்தார்க்கு எல்லாம்'
    },
    {
      type: 'near',
      label: lang === 'ta' ? '1 சொல் பிழை (Near Match)' : '1 Word Wrong',
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகம்'
    },
    {
      type: 'fake',
      label: lang === 'ta' ? 'போலி (Not Found)' : 'Fake AI Couplet',
      text: 'காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்'
    }
  ];

  const handleVerify = async (textToVerify = coupletText) => {
    const { line1: l1, line2: l2 } = parseCouplet(textToVerify);
    const fullText = `${l1.trim()}\n${l2.trim()}`;
    if (!fullText.trim()) return;

    setIsVerifying(true);
    setResult(null);

    try {
      const res = await verifyCoupletLocal(fullText);
      setResult(res);

      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, source_ai: sourceAi })
      }).catch(() => {});

      if (res.status === 'verified') {
        sounds.playStamp?.();
        sounds.playCorrect?.();
      } else if (res.status === 'near_match') {
        sounds.playStamp?.();
      } else {
        sounds.playStamp?.();
        sounds.playWrong?.();
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDemoClick = (chip) => {
    setCoupletText(chip.text);
    handleVerify(chip.text);
  };

  // Web Speech API for Tamil voice input
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'ta' ? 'குரல் உள்ளீடு உலாவியில் ஆதரிக்கப்படவில்லை.' : 'Speech Recognition not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ta-IN';
      recognition.interimResults = false;
      setIsListening(true);

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const words = text.trim().split(/\s+/).filter(Boolean);
        if (words.length >= 7) {
          const formatted = `${words.slice(0, 4).join(' ')}\n${words.slice(4).join(' ')}`;
          setCoupletText(formatted);
        } else {
          setCoupletText(text);
        }
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Image Preprocessing Pipeline for OCR
  const preprocessImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = gray > 140 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const processUploadedFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setOcrError(
        lang === 'ta'
          ? 'படக் கோப்புகளை மட்டுமே பதிவேற்ற முடியும் (JPG, PNG, WebP).'
          : 'Only image files are supported (JPG, PNG, WebP).'
      );
      return;
    }

    setSelectedFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    });
    setUploadStatus('processing');
    setOcrError('');

    try {
      const preprocessedCanvas = await preprocessImage(file);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('tam');
      const ret = await worker.recognize(preprocessedCanvas);
      await worker.terminate();

      const extracted = (ret.data?.text || '').trim();
      const confidence = ret.data?.confidence || 0;

      if (!extracted || confidence < 30) {
        setUploadStatus('error');
        setOcrError(
          lang === 'ta'
            ? 'படத்தின் எழுத்து தெளிவு குறைவாக உள்ளது. நல்ல வெளிச்சத்தில் திருக்குறள் தெளிவாகத் தெரியும் படத்தை பதிவேற்றவும்.'
            : 'Low OCR confidence. Please upload a clear photo with centered couplet text.'
        );
        return;
      }

      const lines = extracted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        setCoupletText(`${lines[0]}\n${lines.slice(1).join(' ')}`);
      } else {
        const words = extracted.split(/\s+/).filter(Boolean);
        if (words.length >= 7) {
          setCoupletText(`${words.slice(0, 4).join(' ')}\n${words.slice(4).join(' ')}`);
        } else {
          setCoupletText(extracted);
        }
      }

      setUploadStatus('success');
    } catch (err) {
      console.error('OCR failed:', err);
      setUploadStatus('error');
      setOcrError(
        lang === 'ta'
          ? 'எழுத்துகளை அடையாளம் காண முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.'
          : 'Failed to extract Tamil text from image.'
      );
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const copyResult = () => {
    if (!result) return;
    const textToCopy = `${APP_CONFIG.name}: ${result.verdict}\n${coupletText}\nStatus: ${result.status}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 font-sans">
      {/* MAIN UNIFIED VERIFICATION CARD - MATCHING REFERENCE IMAGE */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 sm:p-8 text-stone-100 transition-all space-y-5">
        
        {/* Header - Matching Reference Image */}
        <div className="text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold border border-orange-500/30">
              ✔
            </span>
            <span>{lang === 'ta' ? 'சரிபார்ப்பு' : 'Verification'}</span>
          </h2>

          <p className="text-xs sm:text-sm text-stone-300 mt-1 leading-relaxed">
            {lang === 'ta'
              ? 'கீழே உள்ள உரையை சரிபார்த்து, உங்கள் பதிப்புகளைப் பெறுங்கள்.'
              : 'Verify the couplet text below to check authenticity against 1,330 canonical verses.'}
          </p>
        </div>

        {/* 1. ONE UNIFIED CONTINUOUS TEXT INPUT BOX (Combines Line 1 and Line 2) */}
        <div className="relative">
          <textarea
            id="unified-kural-input"
            value={coupletText}
            onChange={(e) => setCoupletText(e.target.value)}
            placeholder={
              lang === 'ta'
                ? 'அறத்தாறாங் கொல் உயர்வு\nஉலகத்தார்க்கு எல்லாம்\n\nபிறப்பொக்கும் எல்லா உயிர்க்கும்\nசிறப்பொவ்வா செய்தொழில் வேற்றுமை யான்.'
                : 'Enter couplet text here...'
            }
            rows={6}
            className="w-full px-5 py-4 rounded-2xl bg-[#070C15] border border-stone-700/80 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-base sm:text-lg leading-relaxed font-serif text-white outline-none transition-all placeholder:text-stone-500 shadow-inner resize-y min-h-[160px]"
          />

          {/* Discreet Word Count Indicator */}
          <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2 pointer-events-none">
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                canVerify
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : totalWords > 7
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}
            >
              {line1Words.length}/4 + {line2Words.length}/3
            </span>
          </div>
        </div>

        {/* Format Guidance Hint */}
        {!canVerify && coupletText.trim() && (
          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {lang === 'ta'
                ? 'முதல் வரியில் 4 சீர்களும், இரண்டாம் வரியில் 3 சீர்களும் (மொத்தம் 7) அமைவது நன்று.'
                : 'Tirukkural meter format: 4 words on the first line, 3 words on the second line.'}
            </span>
          </div>
        )}

        {/* Primary Action Button - Matching Reference Image */}
        <div>
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || !coupletText.trim()}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-base sm:text-lg shadow-lg shadow-orange-500/25 active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{lang === 'ta' ? 'சரிபார்க்கிறது...' : 'Verifying...'}</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>{lang === 'ta' ? 'சரிபார்க்கவும்' : 'Verify'}</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Demo Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-stone-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            {lang === 'ta' ? 'மாதிரிகள்:' : 'Examples:'}
          </span>
          {demoChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleDemoClick(chip)}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#070C15] hover:bg-orange-600 hover:text-white text-stone-300 border border-stone-700/60 transition-all font-medium"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Tools row: Voice Input, AI Source Dropdown */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-700/40">
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              isListening
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/30'
                : 'bg-[#070C15] text-stone-200 border-stone-700 hover:bg-white/10'
            }`}
          >
            <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-white' : 'text-orange-400'}`} />
            <span>{isListening ? (lang === 'ta' ? 'குரல் கேட்கிறது...' : 'Listening...') : (lang === 'ta' ? 'குரலில் உள்ளிடவும்' : 'Voice Input')}</span>
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-400 font-semibold whitespace-nowrap">
              {lang === 'ta' ? 'மூலம்:' : 'Source:'}
            </label>
            <select
              value={sourceAi}
              onChange={(e) => setSourceAi(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#070C15] border border-stone-700 text-stone-200 outline-none focus:border-orange-500"
            >
              {AI_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Large Unified Drag-and-Drop Upload Section */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all p-5 text-center cursor-pointer select-none ${
            isDragging
              ? 'border-orange-400 bg-orange-500/20 scale-[1.01]'
              : 'border-orange-500/35 hover:border-orange-400 bg-[#070C15]/70 hover:bg-[#070C15]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col items-center justify-center">
            <UploadCloud className="w-7 h-7 text-orange-400 mb-2" />
            <h4 className="text-xs sm:text-sm font-bold text-stone-100">
              {lang === 'ta'
                ? 'புகைப்படத்தை இங்கே இழுத்து விடவும் அல்லது கோப்பைத் தேர்ந்தெடுக்கவும்'
                : 'Drag and drop Tirukkural image here or choose file'}
            </h4>

            {/* Choose File Button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-xs shadow-sm flex items-center gap-1.5 mx-auto transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-orange-300" />
                <span>{lang === 'ta' ? 'படத்தைத் தேர்ந்தெடு' : 'Choose File'}</span>
              </button>
            </div>

            {/* Selected File Status */}
            {selectedFile && (
              <div className="mt-3 w-full max-w-sm mx-auto p-2.5 rounded-xl bg-[#060e18] border border-stone-700/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="font-semibold text-stone-200 truncate">{selectedFile.name}</span>
                </div>
                {uploadStatus === 'processing' && (
                  <div className="flex items-center gap-1 text-orange-300 shrink-0">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{lang === 'ta' ? 'படிக்கிறது...' : 'Scanning...'}</span>
                  </div>
                )}
                {uploadStatus === 'success' && (
                  <div className="flex items-center gap-1 text-emerald-400 shrink-0 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ta' ? 'வெற்றி' : 'Ready'}</span>
                  </div>
                )}
                {uploadStatus === 'error' && (
                  <div className="flex items-center gap-1 text-rose-400 shrink-0 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ta' ? 'பிழை' : 'Error'}</span>
                  </div>
                )}
              </div>
            )}

            {uploadStatus === 'success' && (
              <p className="mt-2 text-xs text-emerald-400 font-medium">
                {lang === 'ta'
                  ? '✓ படம் படிக்கப்பட்டது! குறள் வரிகள் மேலே உள்ள ஒரே பெட்டியில் நிரப்பப்பட்டுள்ளன.'
                  : '✓ Image extracted into the single box above.'}
              </p>
            )}

            {uploadStatus === 'error' && ocrError && (
              <div className="mt-2 p-2 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 text-left max-w-sm mx-auto">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{ocrError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Result Presentation */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pt-5 border-t border-stone-700/60 space-y-4"
            >
              {/* 1. VERIFIED */}
              {result.status === 'verified' && (
                <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-xl">
                  <div className="flex items-center gap-3 pb-4 border-b border-emerald-500/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                        {lang === 'ta' ? 'உண்மையான திருக்குறள்' : 'Verified Authentic Couplet'}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1 font-serif">
                        {lang === 'ta' ? 'குறள் எண்' : 'Kural #'} {result.kural?.number} ({result.kural?.chapter_name})
                      </h3>
                    </div>
                  </div>

                  <div className="my-4 p-3.5 rounded-xl bg-[#070C15] border border-stone-700/60 text-center font-serif text-base sm:text-lg font-bold text-white leading-relaxed">
                    <div>{result.kural?.line1}</div>
                    <div className="mt-1">{result.kural?.line2}</div>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm text-stone-200">
                    <p>
                      <strong className="text-orange-400 font-serif">
                        {lang === 'ta' ? 'மு. வரதராசனார் உரை:' : 'Mu. Varadarajanar:'}
                      </strong>{' '}
                      {result.kural?.meaning_mv}
                    </p>
                    <p>
                      <strong className="text-orange-400 font-serif">
                        {lang === 'ta' ? 'சாலமன் பாப்பையா உரை:' : 'Solomon Pappaiah:'}
                      </strong>{' '}
                      {result.kural?.meaning_sp}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. NEAR MATCH */}
              {result.status === 'near_match' && (
                <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 shadow-xl">
                  <div className="flex items-center gap-3 pb-4 border-b border-amber-500/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                      !
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-900/60 text-amber-300 border border-amber-500/40">
                        {lang === 'ta' ? 'தவறானது, திருத்தம் தேவை' : 'Incorrect, Needs Correction'}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1 font-serif">
                        {lang === 'ta' ? result.message_ta : result.message}
                      </h3>
                    </div>
                  </div>

                  {/* Wrong Words vs Correct */}
                  <div className="my-4 space-y-2">
                    {result.wrong_words?.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[#070C15] border border-stone-700/60 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <span className="line-through text-rose-400 font-bold">
                          {w.inputWord}
                        </span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          → {w.canonicalWord || w.correctWord}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#070C15] border border-amber-500/30 text-center font-serif text-base font-bold text-white">
                    <div>{result.kural?.line1}</div>
                    <div className="mt-1">{result.kural?.line2}</div>
                  </div>
                </div>
              )}

              {/* 3. NOT FOUND */}
              {result.status === 'not_found' && (
                <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-xl text-center">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-white text-2xl font-bold mb-2">
                    ✕
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-rose-300 font-serif">
                    {lang === 'ta'
                      ? 'திருக்குறளில் இல்லை. இந்த குறள் 1,330 திருக்குறள் பாடல்களில் காணப்படவில்லை.'
                      : 'Not found. This couplet does not exist in the 1,330 Tirukkural verses.'}
                  </h3>
                </div>
              )}

              {/* Copy Button */}
              <div className="flex justify-end">
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-200 bg-[#070C15] hover:bg-stone-800 border border-stone-700/60 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (lang === 'ta' ? 'நகலெடுக்கப்பட்டது!' : 'Copied!') : (lang === 'ta' ? 'நகலெடு' : 'Copy')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
