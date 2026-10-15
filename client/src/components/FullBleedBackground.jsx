import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Download } from 'lucide-react';

/**
 * FullBleedBackground Component
 * Reusable full-viewport sharp background layer with multi-resolution srcset (AVIF/WebP/JPG),
 * placeholder blur-up, mobile address-bar proof 100lvh, safe object positioning,
 * full-screen toggle button, and mobile PWA install hint.
 */
export default function FullBleedBackground({
  bgImage,
  overlayOpacity = 'medium', // 'light' | 'medium' | 'dark'
  children
}) {
  const [loaded, setLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check Fullscreen API support (unsupported in iOS Safari)
    if (typeof document !== 'undefined') {
      const doc = document;
      const fsSupported = !!(
        doc.fullscreenEnabled ||
        doc.webkitFullscreenEnabled ||
        doc.mozFullScreenEnabled ||
        doc.msFullscreenEnabled
      );
      setCanFullscreen(fsSupported);

      const handleFsChange = () => {
        setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
      };

      doc.addEventListener('fullscreenchange', handleFsChange);
      doc.addEventListener('webkitfullscreenchange', handleFsChange);
      return () => {
        doc.removeEventListener('fullscreenchange', handleFsChange);
        doc.removeEventListener('webkitfullscreenchange', handleFsChange);
      };
    }
  }, []);

  useEffect(() => {
    // Check if running on mobile browser (standalone PWA hides address bar already)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && !isStandalone) {
      setShowInstallHint(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallHint(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallHint(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('மெய்க்குறள் செயலியை நிறுவ உலாவியின் மெனுவில் (Menu) "Add to Home screen" அல்லது "செயலியை நிறுவு" என்பதை அழுத்தவும்.');
    }
  };

  const overlayClass = {
    light: 'bg-gradient-to-b from-[#0B1B2B]/15 via-[#0B1B2B]/25 to-[#0B1B2B]/40',
    medium: 'bg-gradient-to-b from-[#0B1B2B]/25 via-[#0B1B2B]/35 to-[#0B1B2B]/55',
    dark: 'bg-gradient-to-b from-[#0B1B2B]/35 via-[#0B1B2B]/45 to-[#0B1B2B]/65'
  }[overlayOpacity] || 'bg-gradient-to-b from-[#0B1B2B]/25 via-[#0B1B2B]/35 to-[#0B1B2B]/55';

  return (
    <div className="relative min-h-[100dvh] min-h-[100svh] w-full overflow-x-hidden flex flex-col justify-between">
      {/* 1. FIXED BACKGROUND LAYER (z-0 so it is not hidden behind body) */}
      <div
        className="fixed inset-0 w-screen h-[100lvh] z-0 pointer-events-none overflow-hidden select-none bg-[#0B1B2B]"
        aria-hidden="true"
      >
        {bgImage ? (
          /* Dynamic Page-Specific Background */
          <img
            key={bgImage}
            src={bgImage}
            alt="Page background"
            className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in fullbleed-object-pos transform-gpu will-change-transform opacity-100"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        ) : (
          /* Default Login Background with Multi-Resolution Picture Element */
          <>
            <img
              src="/images/bg/bg-placeholder.webp"
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
                loaded ? 'opacity-0' : 'opacity-100 scale-105 filter blur-md'
              } fullbleed-object-pos`}
            />

            <picture>
              <source
                type="image/avif"
                srcSet="
                  /images/bg/bg-640.avif 640w,
                  /images/bg/bg-960.avif 960w,
                  /images/bg/bg-1280.avif 1280w,
                  /images/bg/bg-1920.avif 1920w,
                  /images/bg/bg-2560.avif 2560w,
                  /images/bg/bg-3840.avif 3840w
                "
                sizes="100vw"
              />
              <source
                type="image/webp"
                srcSet="
                  /images/bg/bg-640.webp 640w,
                  /images/bg/bg-960.webp 960w,
                  /images/bg/bg-1280.webp 1280w,
                  /images/bg/bg-1920.webp 1920w,
                  /images/bg/bg-2560.webp 2560w,
                  /images/bg/bg-3840.webp 3840w
                "
                sizes="100vw"
              />
              <img
                src="/images/bg/bg-1920.jpg"
                srcSet="
                  /images/bg/bg-640.jpg 640w,
                  /images/bg/bg-960.jpg 960w,
                  /images/bg/bg-1280.jpg 1280w,
                  /images/bg/bg-1920.jpg 1920w,
                  /images/bg/bg-2560.jpg 2560w,
                  /images/bg/bg-3840.jpg 3840w
                "
                sizes="100vw"
                alt="Thiruvalluvar Kanyakumari classical heritage background"
                onLoad={() => setLoaded(true)}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in fullbleed-object-pos transform-gpu will-change-transform ${
                  loaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </picture>
          </>
        )}

        {/* Ambient Overlay Layer */}
        <div className={`absolute inset-0 ${overlayClass}`} />
      </div>

      {/* 2. FLOATING FULLSCREEN & INSTALL CONTROLS (Top Right) */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 pointer-events-auto">
        {showInstallHint && (
          <button
            onClick={handleInstallClick}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-600/90 hover:bg-amber-500 text-stone-100 text-xs font-medium shadow-lg backdrop-blur-md transition-all border border-amber-400/40"
            title="Install App for Full Screen"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">செயலியை நிறுவு</span>
            <span className="sm:hidden">Install</span>
          </button>
        )}

        {canFullscreen && (
          <button
            onClick={toggleFullscreen}
            type="button"
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            className="p-2 rounded-full bg-stone-900/70 hover:bg-stone-900/90 text-amber-300 border border-amber-500/30 shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
            title={isFullscreen ? 'முழுத்திரையிலிருந்து வெளியேறு (Exit Full Screen)' : 'முழுத்திரை (Full Screen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* 3. PAGE CONTENT */}
      <div className="relative z-10 w-full flex-1 flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
        {children}
      </div>
    </div>
  );
}
