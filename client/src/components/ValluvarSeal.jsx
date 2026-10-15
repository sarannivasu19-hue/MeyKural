import React from 'react';
import { motion } from 'framer-motion';

export default function ValluvarSeal({ type = 'green_seal', confidence = 100 }) {
  // Types: green_seal (Verified), red_cracked_seal (Fake), amber_seal (Uncertain)
  const isVerified = type === 'green_seal';
  const isFake = type === 'red_cracked_seal';
  const isUncertain = type === 'amber_seal';

  const config = {
    green_seal: {
      color: '#15803D',
      borderColor: '#22C55E',
      textColor: '#DCFCE7',
      labelTa: 'உண்மை முத்திரை',
      labelEn: 'AUTHENTIC KURAL',
      subtext: 'திருக்குறள் வாய்மை',
      ringDash: '6 4'
    },
    amber_seal: {
      color: '#D97706',
      borderColor: '#F59E0B',
      textColor: '#FEF3C7',
      labelTa: 'மாற்றப்பட்ட குறள்',
      labelEn: 'ALTERED / UNCERTAIN',
      subtext: 'சொல் திரிபு கண்டறியப்பட்டது',
      ringDash: '10 4'
    },
    red_cracked_seal: {
      color: '#B91C1C',
      borderColor: '#EF4444',
      textColor: '#FEE2E2',
      labelTa: 'போலி மேற்கோள்',
      labelEn: 'FABRICATED / FAKE',
      subtext: 'திருக்குறளில் இல்லை',
      ringDash: '2 4'
    }
  }[type] || {
    color: '#B91C1C',
    borderColor: '#EF4444',
    textColor: '#FEE2E2',
    labelTa: 'போலி',
    labelEn: 'FAKE',
    subtext: 'திருக்குறளில் இல்லை'
  };

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <motion.div
        initial={{ scale: 2.2, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 220 }}
        className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex items-center justify-center select-none shadow-2xl"
        style={{
          backgroundColor: config.color,
          boxShadow: `0 12px 28px -6px ${config.color}80, inset 0 2px 6px rgba(255,255,255,0.3)`
        }}
      >
        {/* Outer Wax Ribbed Rim */}
        <div className="absolute inset-1.5 rounded-full border-2 border-dashed opacity-60" style={{ borderColor: config.borderColor }} />
        <div className="absolute inset-3 rounded-full border border-solid opacity-80" style={{ borderColor: config.borderColor }} />

        {/* Crack SVG for Fake seal */}
        {isFake && (
          <motion.svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <motion.path
              d="M 50 10 L 48 30 L 56 42 L 44 58 L 52 72 L 48 90 M 48 30 L 32 38 M 44 58 L 65 64"
              stroke="#FEE2E2"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            />
          </motion.svg>
        )}

        {/* Seal Content */}
        <div className="flex flex-col items-center justify-center text-center px-2 z-0">
          {/* Top Arc Inscription */}
          <span className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase opacity-90" style={{ color: config.textColor }}>
            {config.labelEn}
          </span>

          {/* Main Tamil Seal Text */}
          <div className="my-1 font-tamilSerif font-bold text-base sm:text-lg leading-tight tracking-wide drop-shadow" style={{ color: '#FFFFFF' }}>
            {config.labelTa}
          </div>

          {/* Score Pill */}
          <div className="px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold tracking-wider bg-black bg-opacity-25 backdrop-blur-sm" style={{ color: config.textColor }}>
            {isVerified ? '100% MATCH' : isUncertain ? `${confidence}% SIMILAR` : '0% MATCH'}
          </div>

          {/* Bottom Subtext */}
          <span className="text-[9px] sm:text-[10px] mt-1 font-tamilSans opacity-85" style={{ color: config.textColor }}>
            {config.subtext}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
