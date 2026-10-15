import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  ChevronDown,
  ShieldAlert
} from 'lucide-react';
import { verifyCoupletLocal, initOfflineData } from '../utils/localVerifier';
import { sounds } from '../utils/audio';
import { APP_CONFIG } from '../config';

// Source AI options – Tamil + English labels
const AI_SOURCES = [
  { value: 'ChatGPT', label: 'ChatGPT' },
  { value: 'Gemini', label: 'Gemini' },
  { value: 'Claude', label: 'Claude' },
  { value: 'Copilot', label: 'Copilot' },
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'Meta AI', label: 'Meta AI' },
  { value: 'Grok', label: 'Grok' },
  { value: 'புத்தகம்/இணையதளம்', label: lang => lang === 'ta' ? 'புத்தகம்/இணையதளம்' : 'Book/Website' },
  { value: 'வேறு', label: lang => lang === 'ta' ? 'வேறு' : 'Other' },
  { value: 'நினைவில்லை', label: lang => lang === 'ta' ? 'நினைவில்லை' : "Don't remember" }
];

// Strict word counter: trim, drop blank lines, ignore punctuation, split by whitespace
function countWordsInLine(line) {
  return line
    .trim()
    .replace(/[\u0964\u0965.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function parseCoupletStrict(text) {
  if (!text || !text.trim()) {
    return {
      line1: '',
      line2: '',
      line1Words: 0,
      line2Words: 0,
      totalLines: 0,
      totalWords: 0,
      tooManyLines: false,
      valid: false
    };
  }

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const totalWords = text
    .trim()
    .replace(/[\u0964\u0965.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  if (rawLines.length === 2) {
    const l1w = countWordsInLine(rawLines[0]);
    const l2w = countWordsInLine(rawLines[1]);
    const isVenba = (l1w === 4 && l2w === 3);
    return {
      line1: rawLines[0],
      line2: rawLines[1],
      line1Words: l1w,
      line2Words: l2w,
      totalLines: 2,
      totalWords,
      tooManyLines: false,
      valid: isVenba
    };
  }

  if (rawLines.length === 1) {
    const words = rawLines[0].replace(/[\u0964\u0965.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length === 7) {
      return {
        line1: words.slice(0, 4).join(' '),
        line2: words.slice(4).join(' '),
        line1Words: 4,
        line2Words: 3,
        totalLines: 1,
        totalWords: 7,
        tooManyLines: false,
        valid: true
      };
    }
    return {
      line1: rawLines[0],
      line2: '',
      line1Words: words.length,
      line2Words: 0,
      totalLines: 1,
      totalWords: words.length,
      tooManyLines: false,
      valid: false
    };
  }

  // Multiline passages (3 or more lines) – preserve all lines fully
  return {
    line1: rawLines[0],
    line2: rawLines[1] || '',
    line1Words: countWordsInLine(rawLines[0]),
    line2Words: countWordsInLine(rawLines[1] || ''),
    totalLines: rawLines.length,
    totalWords,
    tooManyLines: rawLines.length > 2,
    valid: false
  };
}

export default function VerifierScreen({ lang = 'ta', initialText = '' }) {
  const [coupletText, setCoupletText] = useState(initialText || '');
  const [sourceAi, setSourceAi] = useState('');
  const [claimedAdhikaram, setClaimedAdhikaram] = useState('');
  const [claimedKuralNumber, setClaimedKuralNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [chapters, setChapters] = useState([]);

  // Voice Recognition States (idle | recording | processing | completed | failed)
  const [micState, setMicState] = useState('idle');
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');
  const finalTranscriptRef = useRef('');
  const textareaRef = useRef(null);

  // Auto-resize textarea dynamically
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const newHeight = Math.min(Math.max(el.scrollHeight, 140), 400);
      el.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [coupletText, adjustTextareaHeight]);

  // Image upload / OCR states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [ocrError, setOcrError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const parsed = parseCoupletStrict(coupletText);

  // Load chapters for adhikaram dropdown
  useEffect(() => {
    initOfflineData().then((bundle) => {
      setChapters(bundle?.chapters || []);
    });
  }, []);

  // Demo chips
  const demoChips = [
    { type: 'real', label: lang === 'ta' ? 'அசல் (Verified)' : 'Authentic', text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு' },
    { type: 'near', label: lang === 'ta' ? '1 சொல் பிழை' : '1 Word Wrong', text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகம்' },
    { type: 'fake', label: lang === 'ta' ? 'போலி (Fake)' : 'AI Fake', text: 'காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்' }
  ];

  const handleVerify = useCallback(async (textOverride) => {
    const fullText = (textOverride !== undefined ? textOverride : coupletText).trim();
    if (!fullText) return;

    setIsVerifying(true);
    setResult(null);

    try {
      const localRes = await verifyCoupletLocal(fullText);
      setResult(localRes);

      // Log to server + get attribution check + known fakes check
      try {
        const serverRes = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullText,
            source_ai: sourceAi || 'Not from AI',
            claimed_adhikaram: claimedAdhikaram || null,
            claimed_kural_number: claimedKuralNumber ? parseInt(claimedKuralNumber, 10) : null
          })
        });
        if (serverRes.ok) {
          const serverData = await serverRes.json();
          // Merge attribution_check and known_fake from server into result
          setResult(prev => ({
            ...prev,
            attribution_check: serverData.attribution_check,
            known_fake: serverData.known_fake,
            saved_to_known_fakes: serverData.saved_to_known_fakes
          }));
        }
      } catch {}

      if (localRes.status === 'verified') {
        sounds.playCorrect?.();
      } else if (localRes.status === 'near_match') {
        sounds.playStamp?.();
      } else {
        sounds.playWrong?.();
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  }, [coupletText, sourceAi, claimedAdhikaram, claimedKuralNumber]);

  const handleDemoClick = (chip) => {
    setCoupletText(chip.text);
    setResult(null);
    setTimeout(() => handleVerify(chip.text), 50);
  };

  // Continuous Tamil Voice Input with full transcript accumulation & state management
  const handleToggleVoice = () => {
    if (micState === 'recording') {
      if (recognitionRef.current) {
        setMicState('processing');
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicState('failed');
      setMicError(lang === 'ta'
        ? 'உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை (Google Chrome / Microsoft Edge பரிந்துரைக்கப்படுகிறது).'
        : 'Voice input not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setMicError('');
      setMicState('recording');
      baseTextRef.current = coupletText.trim();
      finalTranscriptRef.current = '';

      const recognition = new SpeechRecognition();
      recognition.lang = 'ta-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interim = '';
        let newlyFinalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            newlyFinalized += (newlyFinalized ? ' ' : '') + transcript.trim();
          } else {
            interim += transcript;
          }
        }

        if (newlyFinalized) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + newlyFinalized;
        }

        const base = baseTextRef.current;
        const currentSpoken = (finalTranscriptRef.current + (interim ? (finalTranscriptRef.current ? ' ' : '') + interim : '')).trim();

        // If it's a 7-word couplet without line break, format as 4 words + 3 words
        let formattedSpoken = currentSpoken;
        const words = currentSpoken.split(/\s+/).filter(Boolean);
        if (words.length === 7 && !currentSpoken.includes('\n')) {
          formattedSpoken = `${words.slice(0, 4).join(' ')}\n${words.slice(4).join(' ')}`;
        }

        const combined = base ? `${base}\n${formattedSpoken}` : formattedSpoken;
        setCoupletText(combined);
        setResult(null);
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'no-speech') return;
        setMicState('failed');
        if (e.error === 'not-allowed') {
          setMicError(lang === 'ta'
            ? 'ஒலிவாங்கி (Microphone) அனுமதி மறுக்கப்பட்டது. உலாவியின் அமைப்பில் அனுமதி வழங்கவும்.'
            : 'Microphone permission denied. Please allow microphone access in your browser settings.');
        } else {
          setMicError(lang === 'ta'
            ? `குரல் பதிவு பிழை: ${e.error}`
            : `Voice recognition error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        if (finalTranscriptRef.current.trim()) {
          setMicState('completed');
          setTimeout(() => setMicState('idle'), 3000);
        } else {
          setMicState('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setMicState('failed');
      setMicError(lang === 'ta' ? 'குரல் உள்ளீட்டைத் தொடங்க முடியவில்லை.' : 'Failed to start voice recognition.');
    }
  };

  // Gentle canvas downscale (maintaining continuous tones and high DPI without destructive thresholding)
  const downscaleCanvas = (file) => {
    return new Promise((resolve, reject) => {
      const MAX_DIM = 2200;
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        // Gentle grayscale contrast enhancement preserving continuous tones for Tamil glyphs
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processUploadedFile = async (file) => {
    if (!file) return;

    // Validate supported formats (JPEG, JPG, PNG, WebP, HEIC/HEIF)
    const validExts = /\.(jpe?g|png|webp|heic|heif)$/i;
    const isImageMime = file.type.startsWith('image/') || file.type === 'application/octet-stream';
    const hasValidExt = file.name.match(validExts);

    if (!isImageMime && !hasValidExt) {
      setUploadStatus('error');
      setOcrError(lang === 'ta'
        ? 'படக் கோப்புகளை மட்டுமே ஏற்கலாம் (JPG, PNG, WebP, HEIC).'
        : 'Only image files are supported (JPG, PNG, WebP, HEIC).');
      return;
    }

    // Size limit check (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadStatus('error');
      setOcrError(lang === 'ta'
        ? 'படத்தின் அளவு 15MB-க்கு குறைவாக இருக்க வேண்டும்.'
        : 'File size exceeds maximum allowed 15MB limit.');
      return;
    }

    // Image preview
    setImagePreviewUrl(URL.createObjectURL(file));
    setSelectedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' });
    setUploadStatus('processing');
    setOcrError('');
    setOcrProgress(15);

    // Stage 1: Try Authoritative Backend Preprocessing & OCR Pipeline
    try {
      setOcrProgress(30);
      const base64Data = await fileToBase64(file);
      setOcrProgress(50);

      const res = await fetch('/api/verify-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          filename: file.name,
          mime_type: file.type,
          source_ai: sourceAi || 'Not from AI',
          claimed_adhikaram: claimedAdhikaram || null,
          claimed_kural_number: claimedKuralNumber ? parseInt(claimedKuralNumber, 10) : null
        })
      });

      setOcrProgress(90);

      if (res.ok) {
        const verifyData = await res.json();
        setOcrProgress(100);
        setUploadStatus('success');

        const extractedText = verifyData.extracted_text || '';
        setCoupletText(extractedText);
        setResult(verifyData);

        if (verifyData.status === 'verified') {
          sounds.playCorrect?.();
        } else if (verifyData.status === 'near_match') {
          sounds.playStamp?.();
        } else {
          sounds.playWrong?.();
        }
        return;
      }

      // If backend returned a specific error (e.g. no text or invalid image)
      const errData = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 422) {
        setUploadStatus('error');
        if (errData.code === 'NO_TAMIL_TEXT') {
          setOcrError(lang === 'ta'
            ? 'படத்திலிருந்து தமிழ் எழுத்துக்களை அடையாளம் காண முடியவில்லை. வெளிச்சம் உள்ள தெளிவான படத்தை பதிவேற்றவும்.'
            : 'No readable Tamil text found in the image. Please upload a clearer photo.');
        } else if (errData.code === 'INVALID_IMAGE') {
          setOcrError(lang === 'ta'
            ? 'செல்லுபடியாகாத அல்லது சிதைந்த படக் கோப்பு. வேறு படத்தை முயற்சிக்கவும்.'
            : 'Invalid or corrupted image file. Please try another image.');
        } else {
          setOcrError(errData.error || (lang === 'ta' ? 'படத்தை வாசிப்பதில் பிழை ஏற்பட்டது.' : 'Image OCR processing failed.'));
        }
        return;
      }
    } catch (backendErr) {
      console.warn('Backend OCR unavailable, attempting local fallback:', backendErr);
    }

    // Stage 2: Fallback to client-side OCR if backend is unreachable
    try {
      setOcrProgress(60);
      const canvas = await downscaleCanvas(file);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('tam', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(60 + Math.round((m.progress || 0) * 35));
          }
        }
      });

      const ret = await worker.recognize(canvas);
      await worker.terminate();
      setOcrProgress(100);

      const extracted = (ret.data?.text || '').trim();

      if (!extracted) {
        setUploadStatus('error');
        setOcrError(lang === 'ta'
          ? 'படத்தின் எழுத்து தெளிவு குறைவாக உள்ளது. நல்ல வெளிச்சத்தில் படம் எடுக்கவும்.'
          : 'Low OCR confidence. Please upload a clearer photo with good lighting.');
        return;
      }

      const lines = extracted.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let extractedText = '';
      if (lines.length >= 2) {
        extractedText = `${lines[0]}\n${lines[1]}`;
      } else if (lines.length === 1) {
        const words = lines[0].split(/\s+/).filter(Boolean);
        if (words.length >= 7) {
          extractedText = `${words.slice(0, 4).join(' ')}\n${words.slice(4).join(' ')}`;
        } else {
          extractedText = lines[0];
        }
      }

      setCoupletText(extractedText);
      setResult(null);
      setUploadStatus('success');

      // Trigger verification
      setTimeout(() => handleVerify(extractedText), 150);
    } catch (err) {
      console.error('All OCR methods failed:', err);
      setUploadStatus('error');
      setOcrError(lang === 'ta'
        ? 'எழுத்துகளை அடையாளம் காண முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.'
        : 'Failed to extract Tamil text from image. Please try another image.');
    }
  };

  const handleFileChange = (e) => { const f = e.target.files?.[0]; if (f) processUploadedFile(f); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processUploadedFile(f); };
  const handleRetake = () => { setSelectedFile(null); setUploadStatus('idle'); setOcrError(''); setOcrProgress(0); setImagePreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${APP_CONFIG.name}: ${result.verdict_ta || result.verdict}\n${coupletText}\nStatus: ${result.status}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceLabel = (val) => {
    const src = AI_SOURCES.find(s => s.value === val);
    if (!src) return val;
    return typeof src.label === 'function' ? src.label(lang) : src.label;
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 font-sans">
      <div className="bg-[#0A1322]/95 backdrop-blur-2xl border border-amber-500/25 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.12)] rounded-3xl p-5 sm:p-8 text-stone-100 space-y-6">

        {/* Header with Tamil Literature Motif */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-sm font-bold shadow-[0_4px_12px_rgba(249,115,22,0.35)] border border-amber-400/30">✔</span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight font-serif">
              {lang === 'ta' ? 'மெய்க்குறள் சரிபார்ப்பி' : 'Kural Verifier'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
            {lang === 'ta'
              ? '1,330 திருக்குறள்களின் நம்பகத்தன்மையை உடனடியாகச் சரிபார்க்கிறது. உண்மை / சொல் திரிபு / இல்லை ஆகிய 3 தீர்ப்புகள் மட்டுமே.'
              : 'Zero-hallucination verification against all 1,330 canonical Tirukkural couplets. Exactly 3 outcomes: Verified / Near Match / Not Found.'}
          </p>
        </div>

        {/* UNIFIED TEXT INPUT - ENLARGED, AUTO-RESIZING, READABLE TAMIL */}
        <div className="relative">
          <textarea
            id="unified-kural-input"
            ref={textareaRef}
            value={coupletText}
            onChange={(e) => {
              setCoupletText(e.target.value);
              setResult(null);
              adjustTextareaHeight();
            }}
            placeholder={lang === 'ta'
              ? 'குறள் வரிகள் அல்லது தமிழ் இலக்கிய உரைப்பகுதியை இங்கே உள்ளிடவும்...\n(எடுத்துக்காட்டு: அகர முதல எழுத்தெல்லாம் ஆதி / பகவன் முதற்றே உலகு)'
              : 'Enter Tirukkural couplet or Tamil literary passage here...\n(Line 1: 4 words, Line 2: 3 words)'}
            className="w-full min-h-[140px] max-h-[380px] px-5 sm:px-6 py-4 sm:py-5 rounded-2xl bg-[#060B14] border border-amber-500/20 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 text-lg sm:text-xl lg:text-2xl leading-[1.8] font-serif text-white outline-none transition-all placeholder:text-stone-500 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-y-auto"
          />

          {/* Word and Line counter badge */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-[11px] text-stone-400 font-medium">
              {parsed.valid ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>✔</span>
                  <span>{lang === 'ta' ? 'முறையான குறள் வெண்பா யாப்பு (4 + 3 = 7 சொற்கள்)' : 'Valid Kural Venba Meter (4 + 3 = 7 words)'}</span>
                </span>
              ) : coupletText.trim() ? (
                <span className="text-amber-300 font-medium">
                  {lang === 'ta'
                    ? `${parsed.totalLines || 1} வரிகள் · ${parsed.totalWords} சொற்கள்`
                    : `${parsed.totalLines || 1} line(s) · ${parsed.totalWords} word(s)`}
                </span>
              ) : (
                <span>{lang === 'ta' ? 'முதல் வரி 4 சொற்கள், இரண்டாம் வரி 3 சொற்கள்' : 'Line 1: 4 words, Line 2: 3 words'}</span>
              )}
            </div>

            <div className="pointer-events-none">
              <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                parsed.valid
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : coupletText.trim()
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-stone-950 text-stone-500 border-stone-700/40'
              }`}>
                {parsed.totalWords} {lang === 'ta' ? 'சொற்கள்' : 'words'}
              </span>
            </div>
          </div>
        </div>

        {/* VOICE INPUT STATE NOTIFICATION & ERROR MESSAGES */}
        {micError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{micError}</span>
            </div>
            <button
              onClick={() => setMicError('')}
              className="text-stone-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* VERIFY BUTTON - PROMINENT 3D GRADIENT ELEVATION */}
        <button
          onClick={() => handleVerify()}
          disabled={isVerifying || !coupletText.trim()}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-base sm:text-lg shadow-[0_12px_28px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:shadow-[0_16px_34px_rgba(245,158,11,0.45)] active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2.5 cursor-pointer"
        >
          {isVerifying ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>{lang === 'ta' ? 'சரிபார்க்கிறது...' : 'Verifying against 1,330 Kurals...'}</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>{lang === 'ta' ? 'உண்மையைச் சரிபார்க்கவும்' : 'Verify Authenticity'}</span>
            </>
          )}
        </button>

        {/* Demo Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {lang === 'ta' ? 'மாதிரிகள்:' : 'Examples:'}
          </span>
          {demoChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleDemoClick(chip)}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-[#0A1424] hover:bg-orange-600 hover:text-white text-stone-200 border border-white/10 hover:border-orange-500 transition-all font-medium shadow-sm active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Tools: Voice + Source Fields */}
        <div className="border-t border-white/10 pt-4 space-y-4">
          {/* Voice Input Row with 5 distinct states & visual indicators */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all shadow-sm ${
                micState === 'recording'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.6)] animate-pulse'
                  : micState === 'processing'
                  ? 'bg-amber-600 text-white border-amber-400'
                  : micState === 'completed'
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-[#060B14] text-stone-200 border-stone-700 hover:border-amber-400/50 hover:bg-white/5'
              }`}
            >
              {micState === 'recording' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <Mic className="w-4 h-4 text-white" />
                  <span>{lang === 'ta' ? 'கேட்கிறது... முடிவுக்கு அழுத்தவும்' : 'Listening... Click to Finish'}</span>
                </>
              ) : micState === 'processing' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{lang === 'ta' ? 'மொழிபெயர்க்கிறது...' : 'Processing audio...'}</span>
                </>
              ) : micState === 'completed' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{lang === 'ta' ? 'பதிவு முடிந்தது' : 'Speech Captured'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ta' ? 'குரலில் உள்ளிடவும்' : 'Tamil Voice Recording'}</span>
                </>
              )}
            </button>

            {micState === 'recording' && (
              <span className="text-xs text-rose-400 font-medium animate-pulse">
                {lang === 'ta' ? '● குரல் பதிவு தொடர்கிறது...' : '● Recording speech continuously...'}
              </span>
            )}
          </div>

          {/* SOURCE SECTION */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-[#060C17] border border-stone-700/50">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              {lang === 'ta' ? 'இந்தக் குறளை எங்கிருந்து எடுத்தீர்கள்? (விருப்பத்திற்கேற்ப)' : 'Source Information (Optional)'}
            </p>

            {/* Source AI dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                {lang === 'ta' ? 'இந்தக் குறளை எங்கிருந்து எடுத்தீர்கள்?' : 'Where did you get this kural from?'}
              </label>
              <div className="relative">
                <select
                  value={sourceAi}
                  onChange={(e) => setSourceAi(e.target.value)}
                  className="w-full py-2 pl-3 pr-8 rounded-xl bg-[#070C15] border border-stone-700/80 text-stone-200 text-xs font-medium outline-none focus:border-orange-500 appearance-none"
                >
                  <option value="">{lang === 'ta' ? '— தேர்ந்தெடுக்கவும் —' : '— Select —'}</option>
                  {AI_SOURCES.map((src) => (
                    <option key={src.value} value={src.value}>
                      {typeof src.label === 'function' ? src.label(lang) : src.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Adhikaram + Kural number claimed */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {lang === 'ta' ? 'எந்த அதிகாரம்?' : 'Which Adhikaram?'}
                </label>
                <div className="relative">
                  <select
                    value={claimedAdhikaram}
                    onChange={(e) => setClaimedAdhikaram(e.target.value)}
                    className="w-full py-2 pl-3 pr-7 rounded-xl bg-[#070C15] border border-stone-700/80 text-stone-200 text-xs font-medium outline-none focus:border-orange-500 appearance-none"
                  >
                    <option value="">{lang === 'ta' ? '— தேர்ந்தெடு —' : '— Select —'}</option>
                    {chapters.map((ch) => (
                      <option key={ch.number} value={ch.number}>
                        {ch.number}. {ch.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-500 absolute right-2 top-2.5 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {lang === 'ta' ? 'குறள் எண் (சொல்லப்பட்டது)' : 'Claimed Kural No.'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="1330"
                  value={claimedKuralNumber}
                  onChange={(e) => setClaimedKuralNumber(e.target.value)}
                  placeholder="1 – 1330"
                  className="w-full py-2 px-3 rounded-xl bg-[#070C15] border border-stone-700/80 text-stone-200 text-xs font-medium outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* IMAGE UPLOAD SECTION */}
        {!imagePreviewUrl ? (
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

            <UploadCloud className="w-7 h-7 text-orange-400 mb-2 mx-auto" />
            <h4 className="text-xs sm:text-sm font-bold text-stone-100">
              {lang === 'ta' ? 'புகைப்படம் / கேமரா' : 'Upload Photo or Use Camera'}
            </h4>
            <p className="text-[11px] text-stone-500 mt-1">
              {lang === 'ta' ? 'JPG, PNG, WebP, HEIC — குறள் படத்திலிருந்து தானாக OCR' : 'JPG, PNG, WebP, HEIC — automatic Tamil OCR'}
            </p>

            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {lang === 'ta' ? 'படக் கோப்பு' : 'Choose File'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                {lang === 'ta' ? 'கேமரா' : 'Camera'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-stone-700/60 bg-[#070C15]">
            <img src={imagePreviewUrl} alt="Preview" className="w-full max-h-48 object-contain" />
            <div className="p-3 flex items-center justify-between gap-2">
              {uploadStatus === 'processing' && (
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                    <span className="text-xs text-orange-300">{lang === 'ta' ? 'OCR படிக்கிறது...' : 'OCR scanning...'} {ocrProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
                  </div>
                </div>
              )}
              {uploadStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {lang === 'ta' ? 'OCR வெற்றிகரமாக படிக்கப்பட்டது. சரிபார்ப்பு தானாகத் தொடங்கியது.' : 'OCR success. Verification started automatically.'}
                </span>
              )}
              {uploadStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {ocrError}
                </span>
              )}
              <button
                onClick={handleRetake}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold transition-all"
              >
                {lang === 'ta' ? 'மாற்று / நீக்கு' : 'Retake / Remove'}
              </button>
            </div>
          </div>
        )}

        {/* VERIFICATION RESULT */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pt-4 border-t border-stone-700/60 space-y-4"
            >
              {/* VERIFIED */}
              {result.status === 'verified' && (
                <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-xl">
                  <div className="flex items-center gap-3 pb-4 border-b border-emerald-500/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">✓</div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                        {lang === 'ta' ? 'உண்மையான திருக்குறள்' : 'Verified Authentic'}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1 font-serif">
                        {lang === 'ta' ? 'குறள் எண்' : 'Kural #'} {result.kural?.number}
                        <span className="text-sm font-normal text-stone-400 ml-2">({result.kural?.chapter_name})</span>
                      </h3>
                    </div>
                  </div>
                  <div className="my-4 p-3.5 rounded-xl bg-[#070C15] border border-stone-700/60 text-center font-serif text-base font-bold text-white leading-relaxed">
                    <div>{result.kural?.line1}</div>
                    <div className="mt-1">{result.kural?.line2}</div>
                  </div>
                  <div className="space-y-1.5 text-xs text-stone-300">
                    <p><strong className="text-orange-400">{lang === 'ta' ? 'மு.வ உரை:' : 'Mu.Va:'}</strong> {result.kural?.meaning_mv}</p>
                    <p><strong className="text-orange-400">{lang === 'ta' ? 'பாப்பையா உரை:' : 'Pappaiah:'}</strong> {result.kural?.meaning_sp}</p>
                  </div>
                </div>
              )}

              {/* NEAR MATCH */}
              {result.status === 'near_match' && (
                <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 shadow-xl">
                  <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">!</div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-900/60 text-amber-300 border border-amber-500/40">
                        {lang === 'ta' ? 'சொல் திரிபு (Near Match)' : 'Near Match – Needs Correction'}
                      </span>
                      <p className="text-xs text-amber-200 mt-0.5">
                        {lang === 'ta' ? result.message_ta : result.message}
                      </p>
                    </div>
                  </div>
                  <div className="my-3 space-y-2">
                    {result.wrong_words?.map((w, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[#070C15] border border-stone-700/60 flex items-center justify-between text-xs">
                        <span className="line-through text-rose-400 font-bold">{w.inputWord}</span>
                        <span className="text-emerald-400 font-bold">→ {w.canonicalWord || w.correctWord}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#070C15] border border-amber-500/30 text-center font-serif text-base font-bold text-white">
                    <div>{result.kural?.line1}</div>
                    <div className="mt-1">{result.kural?.line2}</div>
                  </div>
                </div>
              )}

              {/* NOT FOUND */}
              {result.status === 'not_found' && (
                <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-xl text-center">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-white text-2xl font-bold mb-3">✕</div>
                  <h3 className="text-base font-bold text-rose-300 font-serif">
                    {lang === 'ta'
                      ? 'திருக்குறளில் இல்லை. இந்த குறள் 1,330 திருக்குறள் பாடல்களில் காணப்படவில்லை.'
                      : 'Not found. This couplet does not exist in the 1,330 Tirukkural verses.'}
                  </h3>
                </div>
              )}

              {/* KNOWN FAKES REGISTRY PANEL */}
              {result.known_fake && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-bold text-rose-300 text-sm">
                      {lang === 'ta' ? 'அறியப்பட்ட போலி குறள் (Known Fakes Registry)' : 'Known Fake Detected in Registry'}
                    </span>
                  </div>
                  <p className="text-rose-200">
                    {lang === 'ta'
                      ? `இந்தப் போலிக் குறள் ஏற்கனவே ${result.known_fake.source_ai} மூலம் வந்தது (${result.known_fake.detection_count} முறை பதிவு செய்யப்பட்டது).`
                      : `This fake kural was previously detected from ${result.known_fake.source_ai} (${result.known_fake.detection_count} time${result.known_fake.detection_count !== 1 ? 's' : ''} on record).`}
                  </p>
                </div>
              )}

              {/* ATTRIBUTION CHECK PANEL */}
              {result.attribution_check?.performed && (claimedAdhikaram || claimedKuralNumber) && (
                <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  result.attribution_check.is_correct
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : 'bg-amber-950/30 border-amber-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {result.attribution_check.is_correct
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span className={`font-bold text-sm ${result.attribution_check.is_correct ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {lang === 'ta'
                        ? (result.attribution_check.is_correct ? 'அதிகாரம் சரியாகக் கூறப்பட்டது ✓' : 'தவறான அதிகாரம் / குறள் எண் ✗')
                        : (result.attribution_check.is_correct ? 'Attribution Correct ✓' : 'Wrong Attribution ✗')}
                    </span>
                  </div>
                  {claimedAdhikaram && (
                    <div className="flex items-center gap-2 text-stone-300">
                      <span className="font-semibold w-28 shrink-0">{lang === 'ta' ? 'கூறப்பட்ட அதிகாரம்:' : 'Claimed Adhikaram:'}</span>
                      <span>{claimedAdhikaram}</span>
                      {result.attribution_check.adhikaram_match === true && <span className="text-emerald-400">✓</span>}
                      {result.attribution_check.adhikaram_match === false && (
                        <span className="text-rose-400">{lang === 'ta' ? `✗ (உண்மை: ${result.attribution_check.real_adhikaram_number}. ${result.attribution_check.real_adhikaram_name})` : `✗ (real: ${result.attribution_check.real_adhikaram_number}. ${result.attribution_check.real_adhikaram_name})`}</span>
                      )}
                    </div>
                  )}
                  {claimedKuralNumber && (
                    <div className="flex items-center gap-2 text-stone-300">
                      <span className="font-semibold w-28 shrink-0">{lang === 'ta' ? 'கூறப்பட்ட குறள் எண்:' : 'Claimed Kural No:'}</span>
                      <span>{claimedKuralNumber}</span>
                      {result.attribution_check.number_match === true && <span className="text-emerald-400">✓</span>}
                      {result.attribution_check.number_match === false && (
                        <span className="text-rose-400">{lang === 'ta' ? `✗ (உண்மை: ${result.attribution_check.real_kural_number})` : `✗ (real: ${result.attribution_check.real_kural_number})`}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Saved to registry notice */}
              {result.saved_to_known_fakes && (
                <div className="p-2.5 rounded-xl bg-stone-800/70 border border-stone-700/60 text-xs text-stone-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>
                    {lang === 'ta' ? 'இந்தப் போலி குறள் Known Fakes Registry-ல் புதியதாகப் பதிவு செய்யப்பட்டது.' : 'This fake kural has been added to the Known Fakes Registry.'}
                  </span>
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
