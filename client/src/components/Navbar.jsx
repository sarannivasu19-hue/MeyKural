import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BookOpen,
  ShieldAlert,
  Flame,
  BarChart3,
  MessageSquareQuote,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff
} from 'lucide-react';
import { t } from '../utils/translations';
import { sounds } from '../utils/audio';

export default function Navbar({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  darkMode,
  setDarkMode
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { id: 'verify', icon: ShieldCheck, label: t[lang].nav_verify },
    { id: 'library', icon: BookOpen, label: t[lang].nav_library },
    { id: 'police', icon: Flame, label: t[lang].nav_police },
    { id: 'detector', icon: ShieldAlert, label: t[lang].nav_detector },
    { id: 'eval', icon: BarChart3, label: t[lang].nav_eval },
    { id: 'chat', icon: MessageSquareQuote, label: t[lang].nav_chat, badge: !isOnline ? t[lang].needs_internet : null }
  ];

  const toggleSound = () => {
    const newState = sounds.toggleSound();
    setSoundOn(newState);
  };

  return (
    <header className="sticky top-0 z-40 bg-parchment-100/95 dark:bg-ink-950/95 backdrop-blur-md border-b border-parchment-300 dark:border-ink-800 transition-colors shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => setActiveTab('verify')}
          >
            <div className="w-9 h-9 rounded-full bg-temple-turmeric flex items-center justify-center shadow-md border border-amber-300/40 p-1">
              <img src="/valluvar_seal.svg" alt="Valluvar Seal" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-tamilSerif font-bold text-lg leading-tight tracking-tight text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                <span>{lang === 'ta' ? 'குறள் சரிபார்ப்பு' : 'KuralVerify'}</span>
                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/60 font-semibold">
                  P15
                </span>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 hidden sm:block">
                {lang === 'ta' ? 'தமிழ் இலக்கிய AI போலி மேற்கோள் கவசம்' : 'AI Hallucination Shield for Tamil Literature'}
              </p>
            </div>
          </div>

          {/* Controls: Online Pill, Language, Theme, Sound */}
          <div className="flex items-center gap-2">
            {/* Online / Offline Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border shadow-xs transition-colors ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
              }`}
              title={isOnline ? 'Online with internet' : 'Operating fully offline via local database & cache'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xs:inline">{t[lang].online}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-stone-500" />
                  <span className="hidden xs:inline">{t[lang].offline}</span>
                </>
              )}
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-colors"
              title="Toggle Tamil / English"
            >
              {lang === 'ta' ? 'English' : 'தமிழ்'}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              title={soundOn ? 'Sound effects enabled' : 'Muted'}
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              title={darkMode ? 'Light (Parchment)' : 'Dark (Night Ink)'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation (Mobile Scrollable) */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none border-t border-parchment-200 dark:border-ink-900">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-temple-turmeric text-white shadow-sm font-semibold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-parchment-200/80 dark:hover:bg-stone-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
