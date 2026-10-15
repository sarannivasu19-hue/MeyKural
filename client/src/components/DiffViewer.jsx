import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';

export default function DiffViewer({ wordDiff, canonicalKural, lang = 'ta' }) {
  if (!wordDiff || !wordDiff.diffResult || wordDiff.diffResult.length === 0) {
    return null;
  }

  const { diffResult, differences, hasDifferences } = wordDiff;

  return (
    <div className="w-full bg-[#070C15]/95 rounded-2xl border border-white/10 p-4 sm:p-5 mt-4 text-stone-100 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>{lang === 'ta' ? 'சொல் நிலை ஒப்பீடு & மாற்றங்கள்' : 'Side-by-Side Word Diff'}</span>
        </h4>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
            hasDifferences
              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
              : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
          }`}
        >
          {hasDifferences
            ? `${differences.length} ${lang === 'ta' ? 'மாற்றங்கள் கண்டறியப்பட்டன' : 'Difference(s)'}`
            : lang === 'ta'
            ? 'அனைத்து சொற்களும் பொருந்துகின்றன'
            : 'All Words Match Canonical'}
        </span>
      </div>

      {/* Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Text Box */}
        <div className="bg-[#0D1522]/90 p-4 rounded-xl border border-white/10 shadow-md">
          <div className="text-xs font-bold text-stone-300 mb-2 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {lang === 'ta' ? 'உள்ளிடப்பட்ட மேற்கோள்' : 'Input Quotation'}
          </div>
          <div className="font-serif text-base sm:text-lg leading-relaxed flex flex-wrap gap-1.5">
            {diffResult.map((d, idx) => {
              const isMatch = d.status === 'match';
              return (
                <motion.span
                  key={`in-${idx}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    isMatch
                      ? 'text-stone-200'
                      : 'bg-rose-950 text-rose-300 font-bold border border-rose-500/40 shadow-sm'
                  }`}
                >
                  {d.inputWord || <span className="italic text-xs opacity-60">(இல்லை)</span>}
                </motion.span>
              );
            })}
          </div>
        </div>

        {/* Canonical Tirukkural Box */}
        <div className="bg-[#0D1522]/90 p-4 rounded-xl border border-white/10 shadow-md">
          <div className="text-xs font-bold text-stone-300 mb-2 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {lang === 'ta' ? 'அசல் திருக்குறள் (எண் #' + canonicalKural?.number + ')' : `Authentic Kural #${canonicalKural?.number}`}
          </div>
          <div className="font-serif text-base sm:text-lg leading-relaxed flex flex-wrap gap-1.5">
            {diffResult.map((d, idx) => {
              const isMatch = d.status === 'match';
              return (
                <motion.span
                  key={`canon-${idx}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    isMatch
                      ? 'text-stone-200'
                      : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  }`}
                >
                  {d.canonicalWord || <span className="italic text-xs opacity-60">(இல்லை)</span>}
                </motion.span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Differences Breakdown Pills */}
      {hasDifferences && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-xs font-bold text-stone-300 mb-2">
            {lang === 'ta' ? 'கண்டறியப்பட்ட சொல் மாற்றங்கள்:' : 'Specific Word Perturbations:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {differences.map((diff, idx) => (
              <div
                key={`diff-item-${idx}`}
                className="text-xs bg-[#0D1522] border border-amber-500/30 rounded-lg p-2 flex items-center gap-2"
              >
                <span className="font-mono font-bold text-amber-400">#{diff.position}</span>
                <span className="line-through text-rose-400 font-serif">{diff.inputWord || '(வெற்றிடம்)'}</span>
                <span className="text-stone-500">➔</span>
                <span className="font-bold text-emerald-400 font-serif">{diff.canonicalWord}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
