import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import VerifierScreen from './components/VerifierScreen';
import LibraryScreen from './components/LibraryScreen';
import DetectorScreen from './components/DetectorScreen';
import PoliceGameScreen from './components/PoliceGameScreen';
import EvaluationScreen from './components/EvaluationScreen';
import ChatbotScreen from './components/ChatbotScreen';
import { initOfflineData } from './utils/localVerifier';

export default function App() {
  const [activeTab, setActiveTab] = useState('verify');
  const [lang, setLang] = useState(() => localStorage.getItem('kural_lang') || 'ta');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kural_dark') === 'true');
  const [verifyInitialText, setVerifyInitialText] = useState('');

  // Register PWA Service Worker & preload offline bundle
  useEffect(() => {
    initOfflineData().catch((err) => console.warn('Offline data preload error:', err));

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('✅ ServiceWorker registered for offline PWA:', reg.scope);
      }).catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
    }
  }, []);

  // Sync dark mode class to html element
  useEffect(() => {
    localStorage.setItem('kural_dark', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync language to localStorage
  useEffect(() => {
    localStorage.setItem('kural_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const handleSelectForVerify = (verseText) => {
    setVerifyInitialText(verseText);
    setActiveTab('verify');
  };

  return (
    <div className="min-h-screen flex flex-col bg-parchment-100 dark:bg-ink-950 text-stone-900 dark:text-stone-100 font-tamilSans transition-colors duration-300">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Dynamic View */}
      <main className="flex-1 pb-12">
        {activeTab === 'verify' && (
          <VerifierScreen lang={lang} key={verifyInitialText || 'verify-screen'} />
        )}
        {activeTab === 'library' && (
          <LibraryScreen lang={lang} onSelectForVerify={handleSelectForVerify} />
        )}
        {activeTab === 'police' && (
          <PoliceGameScreen lang={lang} />
        )}
        {activeTab === 'detector' && (
          <DetectorScreen lang={lang} onSelectForVerify={handleSelectForVerify} />
        )}
        {activeTab === 'eval' && (
          <EvaluationScreen lang={lang} />
        )}
        {activeTab === 'chat' && (
          <ChatbotScreen lang={lang} />
        )}
      </main>

      {/* Palm-leaf Footer */}
      <footer className="border-t border-parchment-300 dark:border-ink-800 bg-parchment-200/50 dark:bg-ink-900/50 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-temple-turmeric flex items-center justify-center p-0.5">
              <img src="/valluvar_seal.svg" alt="Seal" className="w-full h-full object-contain" />
            </div>
            <span className="font-tamilSerif font-bold text-stone-700 dark:text-stone-300">
              {lang === 'ta' ? 'மெய்க்குறள் • MeyKural' : 'MeyKural • Tirukkural AI Shield'}
            </span>
          </div>
          <div>
            Tamil Hackathon 2026 • Problem P15 • 1,330 Canonical Couplets
          </div>
          <div className="text-[11px] text-stone-400">
            Powered by Offline IndexedDB + Zero-Guesswork Rule Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
