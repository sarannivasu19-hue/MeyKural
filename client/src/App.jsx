import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import LoginPage from './components/LoginPage';
import HomeScreen from './components/HomeScreen';
import VerifierScreen from './components/VerifierScreen';
import LibraryScreen from './components/LibraryScreen';
import PoliceGameScreen from './components/PoliceGameScreen';
import AiReportScreen from './components/AiReportScreen';
import EvaluationScreen from './components/EvaluationScreen';
import ChatbotScreen from './components/ChatbotScreen';
import AdminScreen from './components/AdminScreen';
import FullBleedBackground from './components/FullBleedBackground';
import { initOfflineData } from './utils/localVerifier';
import { APP_CONFIG } from './config';
import { Sun, Moon, LogOut, ShieldCheck, UserCheck, User, ChevronDown } from 'lucide-react';

const PAGE_BACKGROUNDS = {
  home: '/images/pages/bg-home.webp',
  verify: '/images/pages/bg-verify.webp',
  library: '/images/pages/bg-library.webp',
  police: '/images/pages/bg-quiz.webp', // Tamil Voice Quiz
  quiz: '/images/pages/bg-quiz.webp',
  ai_report: '/images/pages/bg-reports.webp', // Reports
  reports: '/images/pages/bg-reports.webp',
  chat: '/images/pages/bg-thiruvalluvar.webp', // Thiruvalluvar
  thiruvalluvar: '/images/pages/bg-thiruvalluvar.webp',
  eval: '/images/pages/bg-reports.webp',
  admin: '/images/pages/bg-reports.webp'
};

export default function App() {
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      if (hash && (PAGE_BACKGROUNDS[hash] || hash === 'admin' || hash === 'eval')) {
        return hash;
      }
      const saved = localStorage.getItem('kural_active_tab');
      if (saved && (PAGE_BACKGROUNDS[saved] || saved === 'admin' || saved === 'eval')) {
        return saved;
      }
    }
    return 'home';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [lang, setLang] = useState(() => localStorage.getItem('kural_lang') || 'ta');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kural_dark') === 'true');
  const [verifyInitialText, setVerifyInitialText] = useState('');

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
      localStorage.setItem('kural_active_tab', tab);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      if (hash && (PAGE_BACKGROUNDS[hash] || hash === 'admin' || hash === 'eval')) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Authentication State
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(() => APP_CONFIG.allowGuest && localStorage.getItem('kural_is_guest') === 'true');
  const [authLoading, setAuthLoading] = useState(true);

  // Check existing session
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  // Preload 1,330 couplets offline bundle
  useEffect(() => {
    initOfflineData().catch((err) => console.warn('Offline data preload error:', err));
  }, []);

  // Sync theme
  useEffect(() => {
    localStorage.setItem('kural_dark', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync lang
  useEffect(() => {
    localStorage.setItem('kural_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('kural_is_guest');
    setActiveTab('home');
  };

  const handleContinueGuest = () => {
    setIsGuest(true);
    localStorage.setItem('kural_is_guest', 'true');
  };

  const handleSelectForVerify = (verseText) => {
    setVerifyInitialText(verseText);
    setActiveTab('verify');
  };

  // If loading session
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-stone-100 dark:bg-stone-950 font-serif">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in and guest is not explicitly allowed -> show Login Page
  if (!user && !(APP_CONFIG.allowGuest && isGuest)) {
    return (
      <div className="min-h-[100dvh] bg-stone-100 dark:bg-stone-950 transition-colors font-serif">
        <LoginPage
          onLoginSuccess={(userData) => {
            setUser(userData);
            if (userData.role === 'admin') setActiveTab('admin');
          }}
          onContinueGuest={handleContinueGuest}
          lang={lang}
        />
      </div>
    );
  }

  const currentBg = PAGE_BACKGROUNDS[activeTab] || PAGE_BACKGROUNDS.home;

  return (
    <FullBleedBackground bgImage={currentBg} overlayOpacity="medium">
      <div className="min-h-[100dvh] flex text-stone-100 font-sans transition-colors overflow-x-hidden">
        {/* Desktop Left Sidebar */}
        <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-safe pb-20 lg:pb-8">
        {/* Top Header Bar (Desktop & Mobile) - Matching Reference Image */}
        <header className="sticky top-0 z-30 bg-[#0B111C]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between text-stone-100">
          <div
            className="flex lg:hidden items-center gap-2 cursor-pointer"
            onClick={() => setActiveTab('home')}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {APP_CONFIG.logoMark}
            </div>
            <span className="font-bold text-base text-white">
              {APP_CONFIG.name}
            </span>
          </div>

          <div className="hidden lg:block"></div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 transition-colors"
            >
              {lang === 'ta' ? 'English' : 'தமிழ்'}
            </button>

            {/* User Profile Pill - Matching Reference Image (Saran ▾) */}
            <div
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121B2A] hover:bg-[#1A263B] border border-white/10 transition-all cursor-pointer shadow-sm select-none"
              title={lang === 'ta' ? 'பயனர் சுயவிவரம் · வெளியேற அழுத்தவும்' : 'User profile · Click to logout'}
            >
              <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-white text-xs">
                <User className="w-3.5 h-3.5 text-stone-200" />
              </div>
              <span className="text-xs font-semibold text-stone-200">
                {user?.username || 'Saran'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </div>
          </div>
        </header>

        {/* Dynamic Screen View */}
        <main className="flex-1 px-3 sm:px-6 py-4 max-w-6xl w-full mx-auto">
          {activeTab === 'home' && (
            <HomeScreen lang={lang} setActiveTab={setActiveTab} user={user} />
          )}
          {activeTab === 'verify' && (
            <VerifierScreen lang={lang} key={verifyInitialText || 'verify-screen'} />
          )}
          {activeTab === 'library' && (
            <LibraryScreen lang={lang} onSelectForVerify={handleSelectForVerify} />
          )}
          {activeTab === 'police' && (
            <PoliceGameScreen lang={lang} />
          )}
          {activeTab === 'ai_report' && (
            <AiReportScreen lang={lang} />
          )}
          {activeTab === 'chat' && (
            <ChatbotScreen lang={lang} />
          )}
          {activeTab === 'eval' && (
            <EvaluationScreen lang={lang} />
          )}
          {activeTab === 'admin' && (
            user?.role === 'admin' ? (
              <AdminScreen lang={lang} />
            ) : (
              <div className="text-center py-16">
                <p className="text-sm text-rose-600">Admin access required. Please log in as admin.</p>
              </div>
            )
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lang={lang}
          user={user}
        />
      </div>
    </div>
  </FullBleedBackground>
  );
}
