import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../config';

import FullBleedBackground from './FullBleedBackground';

export default function LoginPage({ onLoginSuccess, onContinueGuest, lang = 'ta' }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverOnline, setServerOnline] = useState(null);

  // Parallax tilt state for subtle 3D card tilt (max 10-12 deg)
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || window.innerWidth < 1024) return;

    const handlePointerMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      // Max 10 degrees tilt following cursor on desktop
      const rotateY = ((e.clientX - cx) / cx) * 8;
      const rotateX = -((e.clientY - cy) / cy) * 8;
      setCardTilt({ rotateX, rotateY });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reducedMotion]);

  // Check /api/health for server status indicator
  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
      })
      .then((data) => {
        if (isMounted) setServerOnline(data.status === 'healthy');
      })
      .catch(() => {
        if (isMounted) setServerOnline(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Safe JSON API fetcher
  const safeFetchJson = async (url, options) => {
    let res;
    try {
      res = await fetch(url, options);
    } catch {
      throw new Error(lang === 'ta' ? 'சர்வரை அணுக முடியவில்லை (Server not reachable)' : 'Server not reachable');
    }

    const text = await res.text();
    let data = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error(data?.error || (lang === 'ta' ? 'தவறான பயனர்பெயர் அல்லது கடவுச்சொல்' : 'Wrong username or password'));
      }
      if (res.status === 403) {
        throw new Error(data?.error || (lang === 'ta' ? 'அணுகல் மறுக்கப்பட்டது' : 'Access forbidden'));
      }
      if (res.status === 429) {
        throw new Error(data?.error || (lang === 'ta' ? 'அதிக முறை தவறாக முயற்சி செய்யப்பட்டது. 1 நிமிடம் பூட்டப்பட்டது.' : 'Too many attempts. Locked for 1 minute.'));
      }
      throw new Error(data?.error || (lang === 'ta' ? 'பிழை ஏற்பட்டது' : 'An error occurred'));
    }

    if (!data) {
      throw new Error(lang === 'ta' ? 'தவறான தரவு பெறப்பட்டது' : 'Invalid server response');
    }

    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError(lang === 'ta' ? 'பயனர்பெயர் மற்றும் கடவுச்சொல் தேவை' : 'Username and password are required');
      return;
    }

    setLoading(true);

    try {
      if (isAdminMode) {
        // Enforce dedicated Admin Login endpoint (/api/auth/admin-login)
        const data = await safeFetchJson('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim()
          })
        });
        onLoginSuccess(data.user);
      } else if (isRegistering) {
        // User Registration
        const data = await safeFetchJson('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: username.trim(),
            email: email.trim() || undefined,
            password: password.trim()
          })
        });
        onLoginSuccess(data.user);
      } else {
        // Enforce User Login endpoint (/api/auth/login)
        const data = await safeFetchJson('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim()
          })
        });
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullBleedBackground overlayOpacity="light">
      <div className="min-h-[100dvh] w-full flex items-center justify-center lg:justify-end p-4 sm:p-6 lg:p-12">
        {/* Login Card: Frosted Glass / Dark Slate Admin with subtle 3D tilt */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className={`w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 transition-all duration-300 ${
            isAdminMode
              ? 'bg-[#18212b]/90 text-stone-100 border-2 border-[#C9A24A] shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
              : 'bg-[#fffbf0]/85 text-stone-900 border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.2)]'
          }`}
          style={{
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transform: reducedMotion
              ? 'none'
              : `perspective(1000px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`
          }}
        >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md p-1 ${
              isAdminMode ? 'bg-[#C9A24A] text-stone-950 font-bold' : 'bg-amber-600 text-white font-bold'
            }`}>
              {isAdminMode ? <ShieldCheck className="w-6 h-6 text-stone-900" /> : <span className="font-serif text-lg">{APP_CONFIG.logoMark}</span>}
            </div>
            <div className="text-left">
              <h1 className={`font-serif text-xl sm:text-2xl font-bold tracking-tight leading-tight ${
                isAdminMode ? 'text-[#C9A24A]' : 'text-stone-900'
              }`}>
                {APP_CONFIG.name}
              </h1>
              <p className={`text-[11px] font-sans font-medium tracking-wide ${
                isAdminMode ? 'text-stone-300' : 'text-stone-600'
              }`}>
                {APP_CONFIG.subtitle} • {isAdminMode ? (lang === 'ta' ? 'நிர்வாக அறை' : 'Admin Portal') : (lang === 'ta' ? 'அங்கீகாரப் பக்கம்' : 'Authentication')}
              </p>
            </div>
          </div>
          <p className={`text-xs mt-2 italic font-serif ${
            isAdminMode ? 'text-amber-200/90' : 'text-stone-700'
          }`}>
            {lang === 'ta' ? APP_CONFIG.tagline_ta : APP_CONFIG.tagline}
          </p>
        </div>

        {/* User / Admin Segmented Switch */}
        <div className={`flex rounded-2xl p-1 mb-5 text-xs font-bold ${
          isAdminMode ? 'bg-stone-900/80 border border-stone-700' : 'bg-stone-200/70 border border-stone-300/50'
        }`}>
          <button
            type="button"
            onClick={() => {
              setIsAdminMode(false);
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
              !isAdminMode
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{lang === 'ta' ? 'பயனர் உள்நுழைவு' : 'User Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAdminMode(true);
              setIsRegistering(false);
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
              isAdminMode
                ? 'bg-[#C9A24A] text-stone-950 shadow-sm font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'ta' ? 'நிர்வாகி (Admin)' : 'Admin Portal'}</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-3 rounded-2xl text-xs flex items-center gap-2 ${
              isAdminMode
                ? 'bg-rose-950/70 border border-rose-800 text-rose-200'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${
              isAdminMode ? 'text-stone-300' : 'text-stone-700'
            }`}>
              {isAdminMode
                ? (lang === 'ta' ? 'நிர்வாகி பயனர்பெயர்' : 'Admin Username')
                : (lang === 'ta' ? 'பயனர்பெயர் (Username)' : 'Username')}
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdminMode ? 'admin' : (lang === 'ta' ? 'உங்கள் பெயர்...' : 'Enter your name...')}
                className={`w-full py-3 px-4 rounded-2xl text-sm outline-none transition border ${
                  isAdminMode
                    ? 'bg-stone-900/90 text-stone-100 border-stone-700 focus:border-[#C9A24A] focus:ring-1 focus:ring-[#C9A24A]'
                    : 'bg-white/95 text-stone-900 border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500'
                }`}
                required
              />
            </div>
          </div>

          {/* Optional Email for Registration */}
          {!isAdminMode && isRegistering && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-xs font-bold mb-1.5 text-stone-700">
                {lang === 'ta' ? 'மின்னஞ்சல் (விருப்பத்தேர்வு)' : 'Email (Optional)'}
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full py-3 px-4 rounded-2xl text-sm outline-none bg-white/95 text-stone-900 border border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
              />
            </motion.div>
          )}

          <div>
            <label className={`block text-xs font-bold mb-1.5 ${
              isAdminMode ? 'text-stone-300' : 'text-stone-700'
            }`}>
              {lang === 'ta' ? 'கடவுச்சொல் (Password)' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full py-3 px-4 pr-11 rounded-2xl text-sm outline-none transition border ${
                  isAdminMode
                    ? 'bg-stone-900/90 text-stone-100 border-stone-700 focus:border-[#C9A24A] focus:ring-1 focus:ring-[#C9A24A]'
                    : 'bg-white/95 text-stone-900 border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition ${
                  isAdminMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                }`}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isRegistering && (
              <p className="text-[11px] text-stone-600 mt-1">
                {lang === 'ta' ? 'குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும்.' : 'Must be at least 6 characters.'}
              </p>
            )}
          </div>

          {/* Primary Action Button (Turmeric / Gold) */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98] min-h-[44px] ${
              isAdminMode
                ? 'bg-[#C9A24A] hover:bg-[#b89139] text-stone-950'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {loading ? (
              <span>{lang === 'ta' ? 'சரிபார்க்கிறது...' : 'Authenticating...'}</span>
            ) : (
              <>
                <span>
                  {isAdminMode
                    ? (lang === 'ta' ? 'நிர்வாகியாக உள்நுழை' : 'Admin Login')
                    : isRegistering
                    ? (lang === 'ta' ? 'பதிவுசெய்க' : 'Register Account')
                    : (lang === 'ta' ? 'உள்நுழைக' : 'Log In')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* User mode sub-toggle: Login vs Register */}
        {!isAdminMode && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-xs text-amber-800 hover:text-amber-950 font-bold underline min-h-[44px] flex items-center justify-center mx-auto"
            >
              {isRegistering
                ? (lang === 'ta' ? 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழையவும்' : 'Already registered? Log In')
                : (lang === 'ta' ? 'புதிய பயனரா? கணக்கை பதிவு செய்க' : "Don't have an account? Register")}
            </button>
          </div>
        )}

        {/* Continue as Guest option (Behind allowGuest flag) */}
        {APP_CONFIG.allowGuest && (
          <div className="mt-4 pt-4 border-t border-stone-200 text-center">
            <button
              type="button"
              onClick={onContinueGuest}
              className="text-xs text-stone-600 hover:text-stone-900 font-semibold flex items-center justify-center gap-1.5 mx-auto py-2 px-3 rounded-xl hover:bg-stone-100 min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'ta' ? 'விருந்தினராக தொடரவும்' : 'Continue as guest'}</span>
            </button>
          </div>
        )}
      </motion.div>
      </div>
    </FullBleedBackground>
  );
}
