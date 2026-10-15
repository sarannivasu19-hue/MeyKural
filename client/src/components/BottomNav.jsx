import React from 'react';
import {
  Home,
  ShieldCheck,
  BookOpen,
  Swords,
  MessageSquareQuote,
  Lock
} from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab, lang = 'ta', user }) {
  const navItems = [
    { id: 'home', icon: Home, label: lang === 'ta' ? 'முகப்பு' : 'Home' },
    { id: 'verify', icon: ShieldCheck, label: lang === 'ta' ? 'சரிபார்ப்பு' : 'Verify' },
    { id: 'library', icon: BookOpen, label: lang === 'ta' ? 'நூலகம்' : 'Library' },
    { id: 'police', icon: Swords, label: lang === 'ta' ? 'வினாடி வினா' : 'Quiz' },
    { id: 'chat', icon: MessageSquareQuote, label: lang === 'ta' ? 'வள்ளுவர்' : 'AI' }
  ];

  if (user?.role === 'admin') {
    navItems[4] = { id: 'admin', icon: Lock, label: lang === 'ta' ? 'நிர்வாகம்' : 'Admin' };
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121820]/90 backdrop-blur-xl border-t border-white/10 pb-safe shadow-2xl font-sans">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-all ${
                isActive
                  ? 'text-amber-600 dark:text-amber-500 font-bold scale-105'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
