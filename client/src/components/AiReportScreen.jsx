import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Info,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  Sliders,
  Square,
  CheckSquare,
  StopCircle,
  Trash2,
  ExternalLink,
  Clock,
  Database
} from 'lucide-react';

export default function AiReportScreen({ lang = 'ta', user, setActiveTab }) {
  const [activeSubTab, setActiveSubTab] = useState('report'); // 'report' | 'lietest'
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('all'); // 'today' | '7d' | '30d' | 'all'
  const [showHonestyNote, setShowHonestyNote] = useState(false);
  const [expandedAi, setExpandedAi] = useState(null);
  const [aiDetails, setAiDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState(null);

  // Lie test state
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [promptCount, setPromptCount] = useState(10);
  const [lieTestRunning, setLieTestRunning] = useState(false);
  const [lieTestProgress, setLieTestProgress] = useState(0);
  const [currentPromptData, setCurrentPromptData] = useState(null);
  const [lieTestFeed, setLieTestFeed] = useState([]);
  const [lieTestFinalSummary, setLieTestFinalSummary] = useState(null);
  const [lieTestError, setLieTestError] = useState(null);
  const [healthInfo, setHealthInfo] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchStats(dateRange);
    fetchHealth();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats(dateRange, true);
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHealthInfo({
          gemini_key_present: data.has_gemini_key,
          claude_key_present: data.has_claude_key
        });
      } else {
        // Fallback to checking public health
        const resHealth = await fetch('/api/chat/health');
        const hData = await resHealth.json();
        setHealthInfo({
          gemini_key_present: hData.ok,
          claude_key_present: false
        });
      }
    } catch {
      setHealthInfo({ gemini_key_present: true, claude_key_present: false });
    }
  };

  const fetchStats = async (range = dateRange, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/reports/stats?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Failed to fetch live report stats:', e);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const toggleExpandAi = async (sourceAi) => {
    if (expandedAi === sourceAi) {
      setExpandedAi(null);
      return;
    }
    setExpandedAi(sourceAi);
    if (!aiDetails[sourceAi]) {
      setLoadingDetails(true);
      try {
        const res = await fetch(`/api/reports/source/${encodeURIComponent(sourceAi)}`);
        if (res.ok) {
          const data = await res.json();
          setAiDetails((prev) => ({ ...prev, [sourceAi]: data }));
        }
      } catch (e) {
        console.warn('Failed to load source details:', e);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleClearDemoData = async () => {
    if (!window.confirm(lang === 'ta' ? 'அனைத்து டெமோ தரவுகளையும் நிச்சயமாக நீக்கவா?' : 'Are you sure you want to clear all seeded demo data?')) {
      return;
    }
    setClearingDemo(true);
    setDemoMessage(null);
    try {
      const res = await fetch('/api/reports/clear-demo', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setDemoMessage({ type: 'success', text: lang === 'ta' ? 'டெமோ தரவு நீக்கப்பட்டது!' : 'Demo data cleared!' });
        fetchStats(dateRange);
      } else {
        setDemoMessage({ type: 'error', text: data.error || (lang === 'ta' ? 'நீக்க முடியவில்லை (நிர்வாகி அனுமதி தேவை)' : 'Failed (admin required)') });
      }
    } catch {
      setDemoMessage({ type: 'error', text: lang === 'ta' ? 'பிணையப் பிழை' : 'Network error' });
    } finally {
      setClearingDemo(false);
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/reports/export?range=${dateRange}`, '_blank');
  };

  // SSE Lie Test Runner
  const startLieTest = async () => {
    setLieTestRunning(true);
    setLieTestProgress(0);
    setLieTestFeed([]);
    setCurrentPromptData(null);
    setLieTestFinalSummary(null);
    setLieTestError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(
        `/api/reports/lie-test/stream?provider=${selectedProvider}&count=${promptCount}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const match = block.match(/event:\s*(\w+)\s*\ndata:\s*(.+)/s) || block.match(/data:\s*(.+)/s);
          if (match) {
            const rawData = match[2] || match[1];
            try {
              const parsed = JSON.parse(rawData);

              if (block.includes('event: error') || parsed.code === 'RATE_LIMIT' || parsed.code === 'MISSING_KEY') {
                setLieTestError(parsed.error || (lang === 'ta' ? 'சோதனையில் பிழை ஏற்பட்டது' : 'An error occurred during test'));
                setLieTestRunning(false);
                break;
              }

              if (parsed.type === 'progress') {
                setCurrentPromptData(parsed);
                setLieTestFeed((prev) => [parsed, ...prev]);
                setLieTestProgress(Math.round((parsed.index / parsed.total) * 100));
              }

              if (parsed.type === 'done') {
                setLieTestFinalSummary(parsed);
                setLieTestRunning(false);
                fetchStats(dateRange, true); // Refresh stats with new fakes
              }
            } catch (err) {
              console.warn('SSE Parse Error:', err);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setLieTestError(lang === 'ta' ? 'சோதனை பயனரால் ரத்து செய்யப்பட்டது.' : 'Test cancelled by user.');
      } else {
        setLieTestError(err.message || (lang === 'ta' ? 'இணைப்புப் பிழை' : 'Connection error'));
      }
    } finally {
      setLieTestRunning(false);
      abortControllerRef.current = null;
    }
  };

  const cancelLieTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLieTestRunning(false);
  };

  const providersConfig = [
    { id: 'gemini', name: 'Gemini (3.5 Flash)', hasKey: !!healthInfo?.gemini_key_present },
    { id: 'claude', name: 'Claude (3.5 Sonnet)', hasKey: !!healthInfo?.claude_key_present },
    { id: 'chatgpt', name: 'ChatGPT (GPT-4o)', hasKey: false },
    { id: 'deepseek', name: 'DeepSeek', hasKey: false }
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 font-sans">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <span>{lang === 'ta' ? 'AI உண்மைத்தன்மை அறிக்கை' : 'AI Accuracy & Hallucination Report'}</span>
          <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl mx-auto leading-relaxed">
          {lang === 'ta'
            ? 'மெய்க்குறள் சரிபார்ப்பு பதிவுகள் மற்றும் நேரடி AI பரிசோதனைகளின் நேரடித் தரவு. (100% நேர்மையான புள்ளிவிவரம்).'
            : 'Live verification database records and real-time LLM couplet challenge tests. 100% deterministic verification.'}
        </p>
      </div>

      {/* Demo Data Banner if seeded */}
      {stats?.hasDemoData && (
        <div className="mb-4 p-3 sm:p-4 rounded-2xl bg-amber-950/60 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px]">
              {lang === 'ta' ? 'டெமோ தரவு' : 'Demo Data'}
            </span>
            <span>
              {lang === 'ta'
                ? 'தற்போது சில மாதிரி டெமோ தரவுகளும் புள்ளிவிவரத்தில் சேர்க்கப்பட்டுள்ளன.'
                : 'Sample demonstration records are currently included in the database statistics.'}
            </span>
          </div>
          {user?.role === 'admin' ? (
            <button
              onClick={handleClearDemoData}
              disabled={clearingDemo}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold flex items-center gap-1.5 shrink-0 transition-all text-xs active:scale-95 disabled:opacity-50 shadow-md shadow-orange-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearingDemo ? (lang === 'ta' ? 'நீக்குகிறது...' : 'Clearing...') : (lang === 'ta' ? 'டெமோ தரவை நீக்கு' : 'Clear Demo Data')}</span>
            </button>
          ) : (
            <span className="text-[11px] text-amber-400 italic">
              {lang === 'ta' ? '(நிர்வாகி இதை நீக்கலாம்)' : '(Admin can clear)'}
            </span>
          )}
        </div>
      )}

      {demoMessage && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${demoMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'}`}>
          {demoMessage.text}
        </div>
      )}

      {/* Collapsible Honesty Note */}
      <div className="mb-5 rounded-2xl bg-[#0D1522]/90 backdrop-blur-xl border border-white/10 overflow-hidden text-xs text-stone-200 shadow-lg">
        <button
          onClick={() => setShowHonestyNote(!showHonestyNote)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left font-bold text-white hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-orange-400" />
            <span>{lang === 'ta' ? 'நேர்மை உத்தரவாதம் (Honesty Note)' : 'Scientific Honesty Guarantee'}</span>
          </span>
          {showHonestyNote ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </button>
        {showHonestyNote && (
          <div className="px-4 pb-3 pt-1 text-stone-300 border-t border-white/10 leading-relaxed">
            {lang === 'ta'
              ? 'மெய்க்குறள் எப்போதுமே ஒரு உரையின் எழுத்து நடையைக் கொண்டு (stylometry) அது எந்த AI உருவாக்கியது என்று பொய்யாகக் கண்டுபிடிப்பதில்லை. பயனர் சரிபார்க்கும் போது குறிப்பிடும் மூலங்கள், எங்கள் நேரடி API வினாக்கள் மற்றும் அறியப்பட்ட போலிகள் பதிவேடு (Known Fakes Registry) ஆகியவற்றின் மூலமே இந்தத் தரவுகள் திரட்டப்படுகின்றன.'
              : 'MeyKural never claims to identify AI models from writing style or text patterns alone. All stats are drawn from explicit user attributions, direct live API prompt evaluations, and the Known Fakes Registry checked against canonical Tirukkural couples.'}
          </div>
        )}
      </div>

      {/* Sub Tabs: Report vs Lie Test */}
      <div className="flex bg-[#070C15]/80 border border-white/10 p-1 rounded-2xl mb-5 max-w-sm sm:max-w-md mx-auto shadow-inner">
        <button
          onClick={() => setActiveSubTab('report')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeSubTab === 'report'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          {lang === 'ta' ? 'அறிக்கை புள்ளிவிவரம்' : 'Database Stats'}
        </button>
        <button
          onClick={() => setActiveSubTab('lietest')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeSubTab === 'lietest'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          {lang === 'ta' ? 'AI பொய் சோதனை' : 'AI Lie Test'}
        </button>
      </div>

      {/* TAB 1: LIVE REPORT & STATS */}
      {activeSubTab === 'report' && (
        <div className="space-y-5">
          {/* Controls: Date Filter, Refresh Button, CSV Export */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-1 bg-[#070C15]/80 border border-white/10 p-1 rounded-xl text-xs overflow-x-auto">
              {[
                { id: 'today', ta: 'இன்று', en: 'Today' },
                { id: '7d', ta: '7 நாட்கள்', en: '7 Days' },
                { id: '30d', ta: '30 நாட்கள்', en: '30 Days' },
                { id: 'all', ta: 'அனைத்தும்', en: 'All' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setDateRange(filter.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    dateRange === filter.id
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-xs'
                      : 'text-stone-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {lang === 'ta' ? filter.ta : filter.en}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchStats(dateRange)}
                disabled={refreshing}
                className="px-3 py-1.5 rounded-xl bg-[#0D1522] border border-white/10 text-xs font-semibold text-stone-200 hover:bg-[#162338] hover:text-white flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                title={lang === 'ta' ? 'தானாக 30 நொடிகளுக்கு ஒருமுறை புதுப்பிக்கப்படும்' : 'Auto refreshes every 30s'}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{lang === 'ta' ? 'புதுப்பி' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'CSV ஏற்றுமதி' : 'Export CSV'}</span>
              </button>
            </div>
          </div>

          {/* Skeleton Loaders or Stat Tiles */}
          {loadingStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-[#0D1522]/80 border border-white/10" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1522]/90 backdrop-blur-xl border border-white/10 text-center shadow-xl">
                <span className="text-[10px] uppercase font-bold text-stone-400">
                  {lang === 'ta' ? 'மொத்த சோதனைகள்' : 'Total Checks'}
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-0.5">
                  {stats?.totalChecks || 0}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1522]/90 backdrop-blur-xl border border-emerald-500/30 text-center shadow-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-400">
                  {lang === 'ta' ? 'அசல் (Verified)' : 'Verified'}
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-300 mt-0.5">
                  {stats?.verifiedTotal || 0}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1522]/90 backdrop-blur-xl border border-amber-500/30 text-center shadow-xl">
                <span className="text-[10px] uppercase font-bold text-amber-400">
                  {lang === 'ta' ? 'சொல் பிழை (Near)' : 'Near Match'}
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 mt-0.5">
                  {stats?.nearMatchTotal || 0}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1522]/90 backdrop-blur-xl border border-rose-500/30 text-center shadow-xl">
                <span className="text-[10px] uppercase font-bold text-rose-400">
                  {lang === 'ta' ? 'இல்லை (Not Found)' : 'Not Found'}
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-300 mt-0.5">
                  {stats?.notFoundTotal || 0}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loadingStats && (!stats?.bySource || stats.bySource.length === 0) && (
            <div className="p-8 text-center rounded-3xl bg-[#0D1522]/90 backdrop-blur-xl border border-white/10 shadow-xl">
              <Database className="w-10 h-10 text-stone-500 mx-auto mb-2" />
              <h4 className="text-base font-bold text-white">
                {lang === 'ta' ? 'பதிவுகள் எதுவும் இல்லை' : 'No Verification Records Yet'}
              </h4>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                {lang === 'ta'
                  ? 'தேர்ந்தெடுத்த கால வரம்பில் சரிபார்ப்பு பதிவுகள் இல்லை. சரிபார்ப்பு அல்லது பொய் சோதனையைத் தொடங்கவும்.'
                  : 'No checks found for the selected time range. Try running a verification or the AI Lie Test.'}
              </p>
            </div>
          )}

          {/* Breakdown Per AI Provider */}
          {stats?.bySource && stats.bySource.length > 0 && (
            <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10 text-stone-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-orange-400" />
                  <span>{lang === 'ta' ? 'AI வாரியாக முடிவுகள் (விரிவாக்கத் தொடவும்)' : 'Outcome Breakdown Per Provider (Click row to expand)'}</span>
                </h3>
                <span className="text-xs text-stone-400 font-mono">
                  {stats.bySource.length} {lang === 'ta' ? 'மூலங்கள்' : 'sources'}
                </span>
              </div>

              <div className="space-y-3">
                {stats.bySource.map((row, idx) => {
                  const total = row.total_checks || 1;
                  const vPct = Math.round(((row.verified_count || 0) / total) * 100);
                  const nPct = Math.round(((row.near_match_count || 0) / total) * 100);
                  const fPct = Math.round(((row.not_found_count || 0) / total) * 100);
                  const isExpanded = expandedAi === row.source_ai;

                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-white/10 bg-[#070C15]/80 overflow-hidden transition-all"
                    >
                      {/* Clickable Header Bar */}
                      <div
                        onClick={() => toggleExpandAi(row.source_ai)}
                        className="p-3.5 cursor-pointer hover:bg-white/5 select-none transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {row.source_ai}
                            </span>
                            {fPct > 40 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                                {lang === 'ta' ? 'அதிக போலி' : 'High Hallucination'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                            <span>{total} {lang === 'ta' ? 'ஆய்வுகள்' : 'checks'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                          </div>
                        </div>

                        {/* Progress stacked bar */}
                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-stone-900 border border-white/5">
                          <div style={{ width: `${vPct}%` }} className="bg-emerald-500 h-full transition-all" title={`Verified: ${vPct}%`} />
                          <div style={{ width: `${nPct}%` }} className="bg-amber-500 h-full transition-all" title={`Near Match: ${nPct}%`} />
                          <div style={{ width: `${fPct}%` }} className="bg-rose-500 h-full transition-all" title={`Not Found: ${fPct}%`} />
                        </div>

                        {/* Percentage breakdown */}
                        <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-[11px]">
                          <span className="text-emerald-400 font-semibold">
                            {vPct}% {lang === 'ta' ? 'அசல்' : 'Verified'} ({row.verified_count || 0})
                          </span>
                          <span className="text-amber-400 font-semibold">
                            {nPct}% {lang === 'ta' ? 'சொல் பிழை' : 'Near'} ({row.near_match_count || 0})
                          </span>
                          <span className="text-rose-400 font-semibold">
                            {fPct}% {lang === 'ta' ? 'போலி/இல்லை' : 'Not Found'} ({row.not_found_count || 0})
                          </span>
                        </div>
                      </div>

                      {/* Expanded Panel: Recent Checks & Top Recorded Fakes */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/10 bg-[#070C15]/95 p-3.5 sm:p-4 text-xs space-y-4"
                          >
                            {loadingDetails && !aiDetails[row.source_ai] ? (
                              <div className="py-4 text-center text-stone-400 animate-pulse">
                                {lang === 'ta' ? 'விவரங்கள் ஏற்றப்படுகின்றன...' : 'Loading details...'}
                              </div>
                            ) : (
                              <>
                                {/* Top Recorded Fakes from known_fakes */}
                                <div>
                                  <h5 className="font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>
                                      {lang === 'ta'
                                        ? `பதிவான போலி குறள்கள் (Known Fakes Registry) - ${row.source_ai}`
                                        : `Top Recorded Hallucinated Kurals - ${row.source_ai}`}
                                    </span>
                                  </h5>
                                  {aiDetails[row.source_ai]?.topFakes?.length > 0 ? (
                                    <div className="space-y-2">
                                      {aiDetails[row.source_ai].topFakes.map((fake) => (
                                        <div
                                          key={fake.id}
                                          className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-stone-200"
                                        >
                                          <div className="whitespace-pre-line font-medium text-stone-100 leading-snug">
                                            "{fake.fake_text}"
                                          </div>
                                          <div className="flex items-center justify-between text-[11px] text-rose-300 mt-1 font-mono">
                                            <span>
                                              {lang === 'ta' ? `கண்டறியப்பட்டது: ${fake.detection_count} முறை` : `Detected: ${fake.detection_count} times`}
                                            </span>
                                            {fake.claimed_adhikaram && (
                                              <span className="text-stone-400">
                                                {lang === 'ta' ? `கூறப்பட்ட அதிகாரம்: ${fake.claimed_adhikaram}` : `Claimed: ${fake.claimed_adhikaram}`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-stone-400 py-1 italic">
                                      {lang === 'ta' ? 'பதிவான போலி குறள்கள் எதுவும் இல்லை.' : 'No fake kurals logged for this source yet.'}
                                    </div>
                                  )}
                                </div>

                                {/* Recent Checks */}
                                <div>
                                  <h5 className="font-bold text-white flex items-center gap-1.5 mb-2">
                                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                                    <span>{lang === 'ta' ? 'சமீபத்திய ஆய்வுகள் (Recent Checks)' : 'Recent Submissions'}</span>
                                  </h5>
                                  {aiDetails[row.source_ai]?.recentChecks?.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {aiDetails[row.source_ai].recentChecks.map((log) => (
                                        <div
                                          key={log.id}
                                          className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between gap-2"
                                        >
                                          <div className="truncate text-stone-300 max-w-xs sm:max-w-md">
                                            {log.input_text.split('\n')[0]}...
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span
                                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                log.result_status === 'verified'
                                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                                  : log.result_status === 'near_match'
                                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                                                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                                              }`}
                                            >
                                              {log.result_status}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-stone-400 py-1 italic">
                                      {lang === 'ta' ? 'சமீபத்திய சோதனைகள் இல்லை.' : 'No recent checks.'}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI LIE TEST */}
      {activeSubTab === 'lietest' && (
        <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-7 shadow-2xl border border-white/10 space-y-6 text-stone-100">
          <div className="text-center max-w-xl mx-auto">
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              {lang === 'ta' ? 'நேரடி AI பொய் சோதனை (Live Lie Test)' : 'Live AI Lie Test (SSE Evaluator)'}
            </h3>
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              {lang === 'ta'
                ? 'AI தளங்களிடம் நேரடியாக குறள்களைக் கேட்டு, பெறப்படும் குறள்களை எங்கள் கடுமையான சரிபார்ப்பியில் இயக்கி, பொய் மற்றும் திரிபுகளை உடனுக்குடன் கண்டறிகிறது.'
                : 'Directly queries AI providers for Tirukkural couplets and verifies each response against the strict canonical verifier in real-time.'}
            </p>
          </div>

          {/* Configuration Form: Provider Selector & Slider */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#070C15]/80 border border-white/10 space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-2">
                {lang === 'ta' ? 'AI வழங்குநரைத் தேர்ந்தெடுக்கவும்:' : 'Select AI Provider:'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {providersConfig.map((p) => {
                  const isSelected = selectedProvider === p.id;
                  const canSelect = p.hasKey;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (canSelect && !lieTestRunning) setSelectedProvider(p.id);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        !canSelect
                          ? 'opacity-50 bg-[#070C15] border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'border-orange-500 bg-orange-500/20 text-white shadow-xs cursor-pointer'
                          : 'border-white/10 hover:border-orange-400/50 cursor-pointer bg-[#0D1522] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-orange-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400 shrink-0" />
                        )}
                        <span className="font-semibold text-white">{p.name}</span>
                      </div>

                      {!canSelect && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-400">
                          <Key className="w-3 h-3" />
                          <span>{lang === 'ta' ? 'சாவி தேவை' : 'key needed'}</span>
                          {user?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab?.('admin');
                              }}
                              className="underline font-bold text-amber-300 ml-1"
                            >
                              {lang === 'ta' ? 'சேர்க்க' : 'add'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prompt Count Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-bold text-stone-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-orange-400" />
                  <span>{lang === 'ta' ? 'சோதனை வினாக்களின் எண்ணிக்கை:' : 'Prompt Count:'}</span>
                </span>
                <span className="font-bold font-mono text-orange-400 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded">
                  {promptCount} {lang === 'ta' ? 'வினாக்கள்' : 'prompts'}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={promptCount}
                disabled={lieTestRunning}
                onChange={(e) => setPromptCount(parseInt(e.target.value, 10))}
                className="w-full accent-orange-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-stone-400 mt-0.5 font-mono">
                <span>5 ({lang === 'ta' ? 'குறைந்தபட்சம்' : 'min'})</span>
                <span>10</span>
                <span>15</span>
                <span>20 ({lang === 'ta' ? 'அதிகபட்சம்' : 'max'})</span>
              </div>
            </div>

            {/* Error Banner */}
            {lieTestError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{lieTestError}</span>
              </div>
            )}

            {/* Action Buttons: Start and Cancel */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!lieTestRunning ? (
                <button
                  onClick={startLieTest}
                  disabled={!providersConfig.find((p) => p.id === selectedProvider)?.hasKey}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{lang === 'ta' ? 'பொய் சோதனையைத் தொடங்கு' : 'Start Lie Test'}</span>
                </button>
              ) : (
                <button
                  onClick={cancelLieTest}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>{lang === 'ta' ? 'சோதனையை ரத்து செய்' : 'Cancel Test'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Progress Bar */}
          {lieTestRunning && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>
                    {lang === 'ta'
                      ? `வினா ${currentPromptData?.index || 0} / ${promptCount} இயங்குகிறது...`
                      : `Querying prompt ${currentPromptData?.index || 0} / ${promptCount}...`}
                  </span>
                </span>
                <span className="font-mono font-bold text-orange-400">
                  {lieTestProgress}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#070C15] border border-white/10 overflow-hidden">
                <div
                  style={{ width: `${lieTestProgress}%` }}
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                />
              </div>
              {currentPromptData && (
                <div className="text-[11px] text-stone-300">
                  <span className="font-semibold">{lang === 'ta' ? 'தலைப்பு:' : 'Topic:'}</span> {currentPromptData.topic}
                </div>
              )}
            </div>
          )}

          {/* Final Test Summary Card */}
          {lieTestFinalSummary && (
            <div className="p-5 rounded-2xl bg-[#070C15] text-white border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-orange-400">
                  {lang === 'ta' ? 'சோதனை முடிவு சுருக்கம்' : 'Test Outcome Summary'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
                  {selectedProvider.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">
                    {lang === 'ta' ? 'மொத்த வினாக்கள்' : 'Prompts'}
                  </span>
                  <div className="text-xl font-bold font-mono text-white">{lieTestFinalSummary.totalPrompts}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30">
                  <span className="text-[10px] text-rose-300 uppercase font-semibold">
                    {lang === 'ta' ? 'போலி குறள்கள்' : 'Fabrications'}
                  </span>
                  <div className="text-xl font-bold font-mono text-rose-400">{lieTestFinalSummary.fabricatedCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-300 uppercase font-semibold">
                    {lang === 'ta' ? 'உண்மையானவை' : 'Verified'}
                  </span>
                  <div className="text-xl font-bold font-mono text-emerald-400">{lieTestFinalSummary.verifiedCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30">
                  <span className="text-[10px] text-amber-300 uppercase font-semibold">
                    {lang === 'ta' ? 'போலி விகிதம்' : 'Fab Rate'}
                  </span>
                  <div className="text-xl font-bold font-mono text-amber-400">{lieTestFinalSummary.fabricationRate}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Live Feed of evaluated prompts */}
          {lieTestFeed.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                {lang === 'ta' ? 'மதிப்பாய்வு செய்யப்பட்ட குறள்கள்:' : 'Evaluated Prompt Feed:'}
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {lieTestFeed.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs ${
                      item.status === 'verified'
                        ? 'bg-emerald-950/40 border-emerald-500/30'
                        : item.status === 'near_match'
                        ? 'bg-amber-950/40 border-amber-500/30'
                        : 'bg-rose-950/40 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-white">
                        #{item.index} · {item.topic}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          item.status === 'verified'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                            : item.status === 'near_match'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {item.status === 'verified'
                          ? (lang === 'ta' ? 'அசல் குறள்' : 'Verified')
                          : item.status === 'near_match'
                          ? (lang === 'ta' ? 'சொல் திரிபு' : 'Near Match')
                          : (lang === 'ta' ? 'போலி குறள் (Fabricated)' : 'Fabricated Fake')}
                      </span>
                    </div>
                    <div className="whitespace-pre-line font-medium text-stone-100 leading-snug">
                      "{item.couplet}"
                    </div>
                    {item.isFabricated && (
                      <div className="mt-1 text-[11px] text-rose-400 font-medium">
                        ⚠️ {lang === 'ta' ? 'இந்தக் குறள் திருக்குறளில் இல்லை. Known Fakes-ல் பதிவு செய்யப்பட்டது.' : 'Not in Tirukkural. Saved to Known Fakes Registry.'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
