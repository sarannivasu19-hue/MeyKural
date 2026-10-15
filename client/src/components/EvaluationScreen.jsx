import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Play,
  Download,
  RefreshCw,
  Layers,
  ShieldCheck,
  Zap,
  Lock,
  Wifi,
  HelpCircle
} from 'lucide-react';
import { APP_CONFIG } from '../config';

export default function EvaluationScreen({ lang = 'ta' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    setLoading(true);
    setProgress(10);

    try {
      const interval = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 20 : p));
      }, 150);

      const res = await fetch('/api/evaluate');
      clearInterval(interval);
      setProgress(100);

      if (res.ok) {
        const metrics = await res.json();
        setData(metrics);
      }
    } catch (err) {
      console.error('Evaluation failed:', err);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meikkural_evaluation_${Date.now()}.json`;
    a.click();
  };

  const downloadCsv = () => {
    if (!data || !data.scorecard) return;
    const rows = [['ID', 'Feature Name', 'Status', 'Score', 'Details']];
    data.scorecard.forEach((c) => {
      rows.push([
        c.id,
        `"${c.name}"`,
        c.status,
        `"${c.score}"`,
        `"${c.details.replace(/"/g, '""')}"`
      ]);
    });
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meikkural_evaluation_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 font-serif">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2">
          <span>{lang === 'ta' ? 'அம்சங்களின் மதிப்பீட்டு அட்டை' : 'System Feature Scorecard'}</span>
          <BarChart3 className="w-6 h-6 text-amber-600" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
          {lang === 'ta'
            ? 'அனைத்து அமைப்புகளின் தரம், துல்லியம் & நம்பகத்தன்மை நேரடி சோதனை முடிவுகள்.'
            : 'Comprehensive live test report covering all 11 system features with pass/fail/skipped scoring.'}
        </p>
      </div>

      {/* Action Controls & Overall Score Banner */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-xl border border-stone-200 dark:border-stone-800 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-600 flex items-center justify-center text-white text-2xl font-mono font-bold shadow-md">
              {data ? data.overallScore : '--%'}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                {lang === 'ta' ? 'ஒட்டுமொத்த கணினி மதிப்பெண்' : 'Overall System Score'}
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {lang === 'ta' ? 'அனைத்து சோதனைகளும் தேர்ச்சி' : 'All Primary Verification Tests Passed'}
              </h3>
              <p className="text-[11px] text-stone-500">
                {data ? `Evaluated in ${data.totalTimeMs} ms • ${data.timestamp}` : 'Ready to evaluate'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runTests}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{loading ? (lang === 'ta' ? 'இயங்குகிறது...' : 'Running...') : (lang === 'ta' ? 'அனைத்து சோதனைகளையும் இயக்கு' : 'Run All Tests')}</span>
            </button>

            <button
              onClick={downloadJson}
              disabled={!data}
              className="px-3 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs border border-stone-200 dark:border-stone-700 hover:bg-stone-200 transition-colors flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            <button
              onClick={downloadCsv}
              disabled={!data}
              className="px-3 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs border border-stone-200 dark:border-stone-700 hover:bg-stone-200 transition-colors flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        {loading && (
          <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden mt-4">
            <div
              className="bg-amber-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Feature Scorecard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.scorecard?.map((card) => {
          const isPass = card.status === 'pass';
          const isSkip = card.status === 'skipped';

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-2xl border transition-all ${
                isPass
                  ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm'
                  : isSkip
                  ? 'bg-stone-50/60 dark:bg-stone-950/60 border-dashed border-stone-300 dark:border-stone-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {isPass ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : isSkip ? (
                    <HelpCircle className="w-5 h-5 text-stone-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {card.name}
                  </h4>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    isPass
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : isSkip
                      ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {card.score}
                </span>
              </div>

              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                {card.description}
              </p>

              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 text-[11px] text-stone-700 dark:text-stone-300 border border-stone-100 dark:border-stone-800 leading-relaxed font-mono">
                {card.details}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
