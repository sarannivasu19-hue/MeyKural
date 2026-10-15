import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquareQuote,
  Send,
  Bot,
  User,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Mic,
  BookOpen,
  Info,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { APP_CONFIG } from '../config';
import { sounds } from '../utils/audio';

export default function ChatbotScreen({ lang = 'ta' }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: lang === 'ta'
        ? 'வணக்கம்! நான் மெய்க்குறள் ஆய்வாளர். 1,330 திருக்குறள்களின் அடிப்படையில் மட்டுமே பதில் அளிப்பேன். இல்லாத குறள்களை உருவாக்க மாட்டேன். ஏதேனும் குறள் அல்லது மேற்கோள் குறித்துக் கேட்கவும்.'
        : 'Welcome! I am the MeyKural Literary Scholar. I answer strictly from the 1,330 canonical couplets and NEVER fabricate quotations. Ask me about any verse or topic.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHealth, setChatHealth] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [chatLang, setChatLang] = useState(lang);
  const messagesEndRef = useRef(null);

  const quickPrompts = [
    {
      label: chatLang === 'ta' ? 'குறள் 1 விளக்கம்' : 'Meaning of Kural 1',
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு - இதன் பொருள் என்ன?'
    },
    {
      label: chatLang === 'ta' ? 'கணினி குறள் உண்மையா?' : 'Is Computer Kural Real?',
      text: 'காலம் கருதி கணினியைக் கற்பவர் ஞாலம் ஆளப் பெறுவார் - இது உண்மையான திருக்குறளா?'
    },
    {
      label: chatLang === 'ta' ? 'நட்பு பற்றிய குறள்கள்' : 'Kurals on Friendship',
      text: 'நட்பு அதிகாரம் பற்றி முக்கிய குறள்களைக் கூறுக'
    },
    {
      label: chatLang === 'ta' ? 'கல்வியின் சிறப்பு' : 'Importance of Education',
      text: 'கல்வி அதிகாரத்தில் கூறப்படும் முதன்மை அறநெறி யாது?'
    }
  ];

  useEffect(() => {
    fetchChatHealth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchChatHealth = async () => {
    try {
      const res = await fetch('/api/chat/health');
      if (res.ok) {
        const data = await res.json();
        setChatHealth(data);
      }
    } catch {
      setChatHealth({
        status: 'offline',
        configured: false,
        mode: 'local_retrieval_only',
        message: 'Running in offline local retrieval mode.'
      });
    }
  };

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    setInput('');
    const userMsgId = Date.now().toString();
    const newMessages = [...messages, { id: userMsgId, role: 'user', text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const historyContext = newMessages.slice(-5).map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyContext })
      });

      if (!res.ok) {
        throw new Error(`Chat error: ${res.status}`);
      }

      const data = await res.json();
      const botMsgId = (Date.now() + 1).toString();

      // Streaming typewriter simulation
      const fullAnswer = data.answer || '';
      let streamed = '';

      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: 'assistant',
          text: '',
          verifiedCards: data.verifiedCards || [],
          mode: data.mode
        }
      ]);

      // Stream character chunks
      const chunkSize = Math.max(2, Math.floor(fullAnswer.length / 30));
      for (let i = 0; i < fullAnswer.length; i += chunkSize) {
        streamed = fullAnswer.slice(0, i + chunkSize);
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: streamed } : m))
        );
        await new Promise((r) => setTimeout(r, 20));
      }

      // Final complete state
      setMessages((prev) =>
        prev.map((m) => (m.id === botMsgId ? { ...m, text: fullAnswer } : m))
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: `⚠️ சர்வர் தொடர்பு பிழை (${err.message}). ஆஃப்லைன் முறையில் திருக்குறள் நூலகத்தில் நேரடியாகத் தேடவும்.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSend(lastUserMsg.text);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: chatLang === 'ta'
          ? 'வணக்கம்! உரையாடல் அழிக்கப்பட்டது. புதிய வினாவை கேட்கலாம்.'
          : 'Chat cleared. Ask me any question on Tirukkural.'
      }
    ]);
  };

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(chatLang === 'ta' ? 'குரல் உள்ளீடு ஆதரிக்கப்படவில்லை.' : 'Speech Recognition not supported.');
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.lang = chatLang === 'ta' ? 'ta-IN' : 'en-US';
      rec.interimResults = false;
      setIsListening(true);
      rec.onresult = (e) => {
        const spoken = e.results[0][0].transcript;
        setInput(spoken);
        handleSend(spoken);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 font-sans">
      {/* Header with Frosted Glass Shield (Protects against statue photo background) */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl mb-5 text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <span>{chatLang === 'ta' ? 'வள்ளுவர் AI உதவியாளர்' : 'Valluvar AI Scholar'}</span>
          <MessageSquareQuote className="w-6 h-6 text-orange-400" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl mx-auto">
          {chatLang === 'ta'
            ? 'அசல் 1,330 திருக்குறள்களின் அடிப்படையில் மட்டுமே உரைக்கும். கற்பனைக் குறள்களைக் கூறாது.'
            : 'Authoritative RAG retrieval strictly grounded in 1,330 canonical couplets. No hallucinations.'}
        </p>

        {/* Status Badge & Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
          {chatHealth && (
            <span
              className={`text-[11px] px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                chatHealth.ok
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : chatHealth.status === 'missing_key'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${chatHealth.ok ? 'bg-emerald-400 animate-pulse' : chatHealth.status === 'missing_key' ? 'bg-amber-400' : 'bg-rose-400'}`} />
              {chatHealth.ok
                ? `Gemini AI (${chatHealth.model || 'gemini-3.5-flash'}) தயார்`
                : chatHealth.reason || 'AI சாவி இல்லை (ஆஃப்லைன்)'}
            </span>
          )}

          {/* Lang Toggle */}
          <button
            onClick={() => setChatLang(chatLang === 'ta' ? 'en' : 'ta')}
            className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-stone-200 transition-colors"
          >
            {chatLang === 'ta' ? 'தமிழ்' : 'English'}
          </button>

          {/* Clear Chat */}
          <button
            onClick={handleClear}
            className="text-[11px] text-stone-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{chatLang === 'ta' ? 'அழி' : 'Clear'}</span>
          </button>
        </div>

        {/* Friendly banner when key is missing or invalid */}
        {chatHealth && !chatHealth.ok && (
          <div className="mt-3.5 p-3 max-w-xl mx-auto rounded-2xl bg-amber-950/60 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold">
                {chatHealth.status === 'missing_key'
                  ? 'Gemini API சாவி அமைக்கப்படவில்லை'
                  : 'Gemini API சாவி பிழை'}
              </p>
              <p className="text-[11px] mt-0.5 text-stone-300">
                {chatHealth.reason}. AI அரட்டை தற்காலிகமாக இடைநிறுத்தப்பட்டுள்ளது. எனினும் நூலகம், வினாடி வினா, சரிபார்ப்பு உள்ளிட்ட அனைத்துப் பகுதிகளும் வழக்கம் போல முழுமையாக இயங்கும்.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Messages Container */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10 min-h-[420px] max-h-[580px] overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0 shadow-md text-xs font-bold font-serif">
                வ
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none shadow-md shadow-orange-500/20'
                  : 'bg-[#070C15]/90 text-stone-100 rounded-tl-none border border-white/10 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-line leading-relaxed text-stone-100">
                {msg.text}
              </div>

              {/* Self-Verified Canonical Cards */}
              {msg.verifiedCards && msg.verifiedCards.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{chatLang === 'ta' ? 'சுய-சரிபார்க்கப்பட்ட அசல் குறள்' : 'Self-Verified Canonical Couplet'}</span>
                  </div>
                  {msg.verifiedCards.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#0D1522] border border-white/10"
                    >
                      <div className="flex justify-between text-[11px] font-bold text-orange-400 mb-1">
                        <span>குறள் #{c.number} • {c.chapter}</span>
                        <span>{c.translation}</span>
                      </div>
                      <div className="font-serif font-bold text-white leading-kural">
                        {c.line1}
                      </div>
                      <div className="font-serif font-bold text-white leading-kural">
                        {c.line2}
                      </div>
                      {c.meaning && (
                        <p className="mt-1 text-[11px] text-stone-300">
                          {c.meaning}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Copy action */}
              <div className="mt-2 pt-1 flex justify-end gap-2">
                <button
                  onClick={() => copyMessage(msg.id, msg.text)}
                  className="text-stone-400 hover:text-white text-[10px] flex items-center gap-1 transition-colors"
                >
                  {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-semibold">
                <User className="w-4 h-4 text-stone-200" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0 animate-pulse text-xs font-bold font-serif">
              வ
            </div>
            <div className="p-3 rounded-2xl bg-[#070C15]/90 text-xs text-stone-300 rounded-tl-none border border-white/10 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px] text-stone-300">
                {chatLang === 'ta' ? '1,330 குறள்களில் சரிபார்க்கிறது...' : 'Verifying in canonical couplets...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.text)}
            className="text-xs px-3 py-1.5 rounded-xl bg-[#0D1522]/90 hover:bg-orange-500/20 text-stone-200 hover:text-white transition-all border border-white/10 shadow-xs"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <button
          type="button"
          onClick={handleVoice}
          className={`px-3.5 py-3 rounded-2xl border transition-all ${
            isListening
              ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
              : 'bg-[#0D1522] hover:bg-[#152033] text-stone-300 border-white/10'
          }`}
          title="Voice Input (ta-IN)"
        >
          <Mic className="w-4 h-4 text-orange-400" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatLang === 'ta' ? 'குறள் அல்லது பொருள் குறித்துக் கேளுங்கள்...' : 'Ask about any couplet or theme...'}
          className="flex-1 py-3 px-4 rounded-2xl bg-[#070C15] border border-stone-700/80 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-sm text-white placeholder:text-stone-500 outline-none shadow-inner"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={loading || messages.length <= 1}
          className="p-3 rounded-2xl border border-white/10 bg-[#0D1522] hover:bg-[#152033] text-stone-400 hover:text-white disabled:opacity-40 transition-colors"
          title="Regenerate"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
