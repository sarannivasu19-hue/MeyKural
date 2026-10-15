import React from 'react';
import { CheckCircle2, AlertOctagon } from 'lucide-react';

export default function VenbaMeterBadge({ meter, lang = 'ta' }) {
  if (!meter) return null;

  const { valid, line1Cirs, line2Cirs, totalCirs, explanation } = meter;

  return (
    <div className="bg-[#0D1522]/90 rounded-xl p-3 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        {valid ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        ) : (
          <AlertOctagon className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}
        <div>
          <span className="font-bold text-white">
            {lang === 'ta' ? 'குறள் வெண்பா யாப்பு:' : 'Kural Venba Meter:'}
          </span>{' '}
          <span className={valid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {valid
              ? lang === 'ta'
                ? 'முறையான வெண்பா (4+3 சீர்கள்)'
                : 'Valid Kural Venba (4 + 3 cirs)'
              : lang === 'ta'
              ? 'யாப்புப் பிழை கண்டறியப்பட்டது'
              : 'Meter Deviation Detected'}
          </span>
          <p className="text-[11px] text-stone-300 mt-0.5">{explanation}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-[11px]">
        <span
          className={`px-2 py-0.5 rounded border ${
            line1Cirs === 4
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-950 text-amber-300 border-amber-500/40'
          }`}
        >
          L1: {line1Cirs}/4
        </span>
        <span
          className={`px-2 py-0.5 rounded border ${
            line2Cirs === 3
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-950 text-amber-300 border-amber-500/40'
          }`}
        >
          L2: {line2Cirs}/3
        </span>
        <span
          className={`px-2 py-0.5 rounded font-bold border ${
            totalCirs === 7
              ? 'bg-white/10 text-white border-white/20'
              : 'bg-rose-950 text-rose-300 border-rose-500/40'
          }`}
        >
          Σ: {totalCirs}/7
        </span>
      </div>
    </div>
  );
}
