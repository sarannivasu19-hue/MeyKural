import React from 'react';
import {
  Home,
  CheckSquare,
  BookOpen,
  HelpCircle,
  BarChart3,
  User,
  Award,
  Lock,
  Settings,
  LogOut,
  UserCheck
} from 'lucide-react';
import { APP_CONFIG } from '../config';

export default function Sidebar({
  activeTab,
  setActiveTab,
  lang = 'ta',
  setLang,
  darkMode,
  setDarkMode,
  user,
  onLogout
}) {
  const navItems = [
    { id: 'home', icon: Home, label: lang === 'ta' ? 'முகப்பு' : 'Home' },
    { id: 'verify', icon: CheckSquare, label: lang === 'ta' ? 'சரிபார்ப்பு' : 'Verifier' },
    { id: 'library', icon: BookOpen, label: lang === 'ta' ? 'நூலகம்' : 'Library' },
    { id: 'police', icon: HelpCircle, label: lang === 'ta' ? 'தமிழ் வினாடி வினா' : 'Tamil Quiz' },
    { id: 'ai_report', icon: BarChart3, label: lang === 'ta' ? 'அறிக்கை' : 'Report' },
    { id: 'chat', icon: User, label: lang === 'ta' ? 'திருவள்ளுவர்' : 'Thiruvalluvar' },
    { id: 'eval', icon: Award, label: lang === 'ta' ? 'மதிப்பெண்' : 'Scorecard' }
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', icon: Lock, label: lang === 'ta' ? 'நிர்வாக அறை' : 'Admin Panel' });
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0B111C]/95 backdrop-blur-xl border-r border-white/10 text-stone-100 h-screen sticky top-0 p-5 shrink-0 font-sans select-none shadow-2xl">
      {/* Brand & Logo Mark - Matching Reference Image */}
      <div
        className="flex items-center gap-3 cursor-pointer pb-6 border-b border-white/10"
        onClick={() => setActiveTab('home')}
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-orange-500/30">
          {APP_CONFIG.logoMark}
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight text-white">
            {APP_CONFIG.name}
          </h1>
        </div>
      </div>

      {/* Nav List - Matching Reference Image */}
      <nav className="flex-1 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25 scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Controls: Settings & Logout - Matching Reference Image */}
      <div className="pt-4 border-t border-white/10 space-y-1.5">
        <button
          onClick={() => {
            if (user?.role === 'admin') {
              setActiveTab('admin');
            } else {
              setLang(lang === 'ta' ? 'en' : 'ta');
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-stone-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings className="w-4 h-4 text-stone-400" />
          <span>{lang === 'ta' ? 'அமைப்புகள்' : 'Settings'}</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-stone-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4 text-stone-400" />
          <span>{lang === 'ta' ? 'வெளியேறு' : 'Logout'}</span>
        </button>
      </div>
    </aside>
  );
}
