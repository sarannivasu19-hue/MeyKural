import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function TrustGauge({ score = 100, level = 'authentic', lang = 'ta' }) {
  // Level: authentic (green), suspicious (amber), fabricated (red)
  // Score: 0 to 100
  // Needle angle: -90deg (0%) to +90deg (100%)
  const clampedScore = Math.max(0, Math.min(100, score));
  const needleRotation = -90 + (clampedScore / 100) * 180;

  const labels = {
    ta: {
      authentic: 'அசல் திருக்குறள் (Authentic)',
      suspicious: 'சந்தேகத்திற்குரியது (Suspicious)',
      fabricated: 'போலி மேற்கோள் (Fabricated)'
    },
    en: {
      authentic: 'Authentic Couplet',
      suspicious: 'Suspicious / Altered',
      fabricated: 'Fabricated / Hallucinated'
    }
  }[lang] || {};

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-[#0D1522]/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
        {level === 'authentic' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
        {level === 'suspicious' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
        {level === 'fabricated' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
        <span>{lang === 'ta' ? 'நம்பகத்தன்மை அளவீடு' : 'Trust Gauge'}</span>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative w-56 h-28 overflow-hidden flex items-end justify-center">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 95 A 80 80 0 0 1 180 95"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="16"
            strokeLinecap="round"
            className="dark:stroke-stone-700"
          />

          {/* Red Zone (0 - 58%) */}
          <path
            d="M 20 95 A 80 80 0 0 1 85 24"
            fill="none"
            stroke="#EF4444"
            strokeWidth="16"
            strokeDasharray="1 1"
            className="opacity-80"
          />

          {/* Amber Zone (58 - 88%) */}
          <path
            d="M 85 24 A 80 80 0 0 1 142 36"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="16"
            strokeDasharray="1 1"
            className="opacity-80"
          />

          {/* Green Zone (88 - 100%) */}
          <path
            d="M 142 36 A 80 80 0 0 1 180 95"
            fill="none"
            stroke="#10B981"
            strokeWidth="16"
            strokeDasharray="1 1"
            className="opacity-90"
          />
        </svg>

        {/* Animated Needle */}
        <motion.div
          className="absolute bottom-0 w-1.5 h-20 origin-bottom bg-stone-800 dark:bg-stone-100 rounded-t-full shadow-md"
          initial={{ rotate: -90 }}
          animate={{ rotate: needleRotation }}
          transition={{ type: 'spring', damping: 15, stiffness: 120 }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <div className="w-3.5 h-3.5 bg-stone-900 dark:bg-white rounded-full absolute -bottom-1 -left-1 border-2 border-amber-500 shadow" />
        </motion.div>
      </div>

      {/* Numerical and State Readout */}
      <div className="mt-3 text-center">
        <div className="text-2xl font-bold font-mono tracking-tight text-white">
          {clampedScore}%
        </div>
        <div
          className={`text-xs font-bold mt-1 px-3 py-1 rounded-full inline-block border ${
            level === 'authentic'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : level === 'suspicious'
              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
              : 'bg-rose-950 text-rose-300 border-rose-500/40'
          }`}
        >
          {labels[level] || level}
        </div>
      </div>
    </div>
  );
}
