import React from 'react';
import { CheckCircle2, AlertOctagon } from 'lucide-react';

export default function VenbaMeterBadge({ meter, lang = 'ta' }) {
  if (!meter) return null;

  const { valid, line1Cirs, line2Cirs, totalCirs, explanation } = meter;

  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl p-3 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2">
        {valid ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        ) : (
          <AlertOctagon className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
        <div>
          <span className="font-bold text-stone-800 dark:text-stone-200">
            {lang === 'ta' ? 'குறள் வெண்பா யாப்பு:' : 'Kural Venba Meter:'}
          </span>{' '}
          <span className={valid ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
            {valid
              ? lang === 'ta'
                ? 'முறையான வெண்பா (4+3 சீர்கள்)'
                : 'Valid Kural Venba (4 + 3 cirs)'
              : lang === 'ta'
              ? 'யாப்புப் பிழை கண்டறியப்பட்டது'
              : 'Meter Deviation Detected'}
          </span>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{explanation}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-[11px]">
        <span
          className={`px-2 py-0.5 rounded ${
            line1Cirs === 4
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          L1: {line1Cirs}/4
        </span>
        <span
          className={`px-2 py-0.5 rounded ${
            line2Cirs === 3
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          L2: {line2Cirs}/3
        </span>
        <span
          className={`px-2 py-0.5 rounded font-bold ${
            totalCirs === 7
              ? 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
          }`}
        >
          Σ: {totalCirs}/7
        </span>
      </div>
    </div>
  );
}
