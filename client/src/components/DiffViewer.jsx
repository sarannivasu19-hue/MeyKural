import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';

export default function DiffViewer({ wordDiff, canonicalKural, lang = 'ta' }) {
  if (!wordDiff || !wordDiff.diffResult || wordDiff.diffResult.length === 0) {
    return null;
  }

  const { diffResult, differences, hasDifferences } = wordDiff;

  return (
    <div className="w-full bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 mt-4">
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3 mb-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>{lang === 'ta' ? 'சொல் நிலை ஒப்பீடு & மாற்றங்கள்' : 'Side-by-Side Word Diff'}</span>
        </h4>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            hasDifferences
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
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
        <div className="bg-white dark:bg-stone-800/80 p-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm">
          <div className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {lang === 'ta' ? 'உள்ளிடப்பட்ட மேற்கோள்' : 'Input Quotation'}
          </div>
          <div className="font-tamilSerif text-base sm:text-lg leading-relaxed flex flex-wrap gap-1.5">
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
                      ? 'text-stone-800 dark:text-stone-200'
                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 font-bold border border-rose-300 dark:border-rose-800 shadow-sm'
                  }`}
                >
                  {d.inputWord || <span className="italic text-xs opacity-60">(இல்லை)</span>}
                </motion.span>
              );
            })}
          </div>
        </div>

        {/* Canonical Tirukkural Box */}
        <div className="bg-white dark:bg-stone-800/80 p-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm">
          <div className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {lang === 'ta' ? 'அசல் திருக்குறள் (எண் #' + canonicalKural?.number + ')' : `Authentic Kural #${canonicalKural?.number}`}
          </div>
          <div className="font-tamilSerif text-base sm:text-lg leading-relaxed flex flex-wrap gap-1.5">
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
                      ? 'text-stone-800 dark:text-stone-200'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-800 shadow-sm'
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
        <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800">
          <div className="text-xs font-bold text-stone-600 dark:text-stone-400 mb-2">
            {lang === 'ta' ? 'கண்டறியப்பட்ட சொல் மாற்றங்கள்:' : 'Specific Word Perturbations:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {differences.map((diff, idx) => (
              <div
                key={`diff-item-${idx}`}
                className="text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg p-2 flex items-center gap-2"
              >
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">#{diff.position}</span>
                <span className="line-through text-rose-600 dark:text-rose-400 font-tamilSerif">{diff.inputWord || '(வெற்றிடம்)'}</span>
                <span className="text-stone-400">➔</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 font-tamilSerif">{diff.canonicalWord}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
