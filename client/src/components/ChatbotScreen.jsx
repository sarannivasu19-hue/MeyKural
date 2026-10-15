import React, { useState } from 'react';
import { MessageSquareQuote, Send, Bot, User, ExternalLink, ShieldCheck, WifiOff, AlertCircle } from 'lucide-react';
import { t } from '../utils/translations';
import { verifyCoupletLocal, searchOfflineKurals } from '../utils/localVerifier';

export default function ChatbotScreen({ lang = 'ta' }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: lang === 'ta'
        ? 'வணக்கம்! நான் வள்ளுவர் AI ஆய்வாளர். 1,330 திருக்குறள்களின் அடிப்படையில் மட்டுமே பதில் அளிப்பேன். இல்லாத குறள்களை உருவாக்க மாட்டேன். ஏதேனும் குறள் அல்லது மேற்கோள் குறித்துக் கேட்கவும்.'
        : 'Welcome! I am the Valluvar AI Assistant. I answer strictly from the canonical 1,330 couplets and NEVER fabricate quotations. Ask me about any verse or verification.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const quickPrompts = [
    {
      label: lang === 'ta' ? 'குறள் 1 விளக்கம்' : 'Meaning of Kural 1',
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு - இதன் பொருள் என்ன?'
    },
    {
      label: lang === 'ta' ? 'கணினி குறள் உண்மையா?' : 'Is Computer Kural Real?',
      text: 'காலம் கருதி கணினியைக் கற்பவர் ஞாலம் ஆளப் பெறுவார் - இது உண்மையான திருக்குறளா?'
    },
    {
      label: lang === 'ta' ? 'நட்பு பற்றிய குறள்' : 'Couplet on Friendship',
      text: 'நட்பு அதிகாரம் பற்றி ஒரு குறள் கூறுங்கள்'
    }
  ];

  const handleSend = async (messageText = input) => {
    const text = messageText.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // 1. If online, call server RAG proxy
      let handled = false;
      if (isOnline) {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, history: messages.slice(-4) })
          });
          if (res.ok) {
            const data = await res.json();
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                text: data.answer,
                cites: data.cites,
                trustedUrl: data.trusted_site_url
              }
            ]);
            handled = true;
          }
        } catch (e) {
          // network error fallback
        }
      }

      // 2. Offline Fallback RAG: Local Couplet Verification & Search
      if (!handled) {
        let reply = '';
        const vResult = await verifyCoupletLocal(text);

        if (vResult && vResult.status === 'verified') {
          reply = `✅ [உண்மையான குறள் - Kural #${vResult.kural.number}]\n"${vResult.kural.line1} / ${vResult.kural.line2}"\n\nஅதிகாரம்: ${vResult.kural.chapter_name}\nபொருள்: ${vResult.kural.meaning_mv}\nEnglish: ${vResult.kural.translation_en}`;
        } else if (vResult && (vResult.status === 'fake' || vResult.status === 'uncertain')) {
          reply = `❌ [போலி / திரிபு மேற்கோள்]\nஇந்த வரிகள் திருக்குறளில் உள்ள 1,330 குறள்களில் இல்லை!\n\n${vResult.recommendation}\n\nஅருகிலுள்ள அசல் குறள்: #${vResult.nearest_kural?.number} ("${vResult.nearest_kural?.line1} / ${vResult.nearest_kural?.line2}")\n\nமேற்கோள் சரிபார்க்க நம்பகமான தளம்: ${vResult.trusted_site_url}`;
        } else {
          // General query search
          const results = await searchOfflineKurals(text, { limit: 2 });
          if (results.results && results.results.length > 0) {
            const k = results.results[0];
            reply = `📖 திருக்குறள் #${k.number} [${k.chapter_name}]:\n"${k.line1} / ${k.line2}"\n\nபொருள்: ${k.meaning_mv}\nஆங்கிலம்: ${k.translation_en}`;
          } else {
            reply = `நான் 1,330 திருக்குறள்களின் அடிப்படையில் மட்டுமே பதில் அளிக்கும் AI. நீங்கள் கேட்ட மேற்கோளை உறுதிப்படுத்த முடியவில்லை. நம்பகமான தளத்தில் பார்க்கவும்: https://thirukkural.gokulnath.com`;
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: reply,
            isOfflineGenerated: true,
            trustedUrl: 'https://thirukkural.gokulnath.com'
          }
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-tamilSerif text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2">
          <span>{t[lang].chatbot_title}</span>
          <MessageSquareQuote className="w-6 h-6 text-temple-turmeric" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
          {t[lang].chatbot_disclaimer}
        </p>
      </div>

      {/* Online / Offline status badge */}
      <div className="flex justify-center mb-4">
        {!isOnline && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700">
            <WifiOff className="w-3.5 h-3.5" />
            <span>{t[lang].needs_internet} - Local Retrieval Active</span>
          </div>
        )}
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl p-4 sm:p-6 shadow-parchment-card border border-parchment-300 dark:border-ink-800 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-temple-turmeric flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-tr-none'
                  : 'bg-parchment-100 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100 rounded-tl-none border border-parchment-300 dark:border-stone-700'
              }`}
            >
              {msg.text}

              {/* Citations and trusted link */}
              {msg.trustedUrl && (
                <div className="mt-3 pt-2 border-t border-stone-200 dark:border-stone-700 flex items-center gap-2">
                  <a
                    href={msg.trustedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <span>{t[lang].check_trusted_site}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-temple-turmeric flex items-center justify-center text-white flex-shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-2xl bg-parchment-100 dark:bg-stone-800 text-xs text-stone-500 rounded-tl-none animate-pulse">
              {lang === 'ta' ? 'வள்ளுவர் மேற்கோள்களைச் சரிபார்க்கிறார்...' : 'Searching Tirukkural index...'}
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.text)}
            className="text-xs px-3 py-1.5 rounded-xl bg-parchment-200/80 dark:bg-stone-800 hover:bg-temple-turmeric hover:text-white transition-all text-stone-700 dark:text-stone-300 border border-parchment-300 dark:border-stone-700 shadow-xs"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t[lang].chatbot_placeholder}
          className="flex-1 py-3 px-4 rounded-2xl bg-white dark:bg-ink-900 border-2 border-parchment-300 dark:border-ink-800 focus:border-temple-turmeric focus:ring-1 focus:ring-amber-500 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 font-tamilSans shadow-xs"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 rounded-2xl bg-temple-turmeric hover:bg-amber-600 text-white font-bold text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
