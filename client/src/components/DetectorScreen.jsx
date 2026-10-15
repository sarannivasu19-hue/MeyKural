import React from 'react';
import { ShieldAlert, AlertTriangle, Cpu, Sparkles, BookOpen, ExternalLink, ArrowRight } from 'lucide-react';
import { t } from '../utils/translations';

export default function DetectorScreen({ lang = 'ta', onSelectForVerify }) {
  const fakeExamples = [
    {
      id: 1,
      category: lang === 'ta' ? 'கால முரண்பாடு (Anachronism)' : 'Anachronistic AI Fake',
      quote: 'காலம் கருதி கணினியைக் கற்பவர்\nஞாலம் ஆளப் பெறுவார்',
      whyFake: lang === 'ta'
        ? 'AI நவீன சொல்லான "கணினி" (Computer) என்ற சொல்லைப் புகுத்தி குறள் போன்று உருவாக்கியுள்ளது. திருவள்ளுவர் காலத்தில் கணினி இல்லை!'
        : 'The LLM inserted the 20th-century word "கணினி" (computer) into a 2,000-year-old classical verse.',
      nearest: 'குறள் #484: ஞாலம் கருதினும் கைகூடும் காலம் கருதி இடத்தால் செயின்',
      badge: '0% Match'
    },
    {
      id: 2,
      category: lang === 'ta' ? 'அறநெறி திரிபு (Moral Inversion)' : 'Moral Inversion Perturbation',
      quote: 'கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தகாத',
      whyFake: lang === 'ta'
        ? 'அசல் குறளின் "நிற்க அதற்குத் தக" (கற்றபடி வாழ்க) என்பதை "தகாத" என மாற்றி அறநெறியையே தலைகீழாக மாற்றிவிட்டது!'
        : 'Perturbed the authentic ending "தக" (conform to morals) into "தகாத" (do not conform), inverting the ethical commandment.',
      nearest: 'குறள் #391: கற்க கசடறக் கற்பவை கற்றபின் நிற்க அதற்குத் தக',
      badge: 'Altered 1 Word'
    },
    {
      id: 3,
      category: lang === 'ta' ? 'பிற இலக்கியக் கலப்பு (Misattribution)' : 'Poetry Misattribution',
      quote: 'யாதும் ஊரே யாவரும் கேளிர் தீதும்\nநன்றும் பிறர்தர வாரா',
      whyFake: lang === 'ta'
        ? 'இது கணியன் பூங்குன்றனாரின் புறநானூற்றுப் பாடல் (பாடல் 192). திருக்குறள் அல்ல!'
        : 'Attributed Kaniyan Pungundranar’s famous Purananuru verse 192 to Tirukkural.',
      nearest: 'புறநானூறு 192 (சங்க இலக்கியம்)',
      badge: 'Not Tirukkural'
    },
    {
      id: 4,
      category: lang === 'ta' ? 'போலி உவமை (Pseudo-Venba Mimicry)' : 'Pseudo-Venba Hallucination',
      quote: 'அன்பும் அறனும் அறிவும் உடையார்க்குத்\nதுன்பம் ஒருபோதும் இல்லை',
      whyFake: lang === 'ta'
        ? 'வள்ளுவரின் சொற்களைப் போன்ற ஓசை நயத்துடன் AI உருவாக்கிய போலி வெண்பா.'
        : 'AI imitated Sangam vocabulary into an authentic-sounding moralizing couplet that has zero historical existence.',
      nearest: 'குறள் #45: அன்பும் அறனும் உடைத்தாயின் இல்வாழ்க்கை பண்பும் பயனும் அது',
      badge: '0% Match'
    },
    {
      id: 5,
      category: lang === 'ta' ? 'பாரதியார் பாடல் திரிபு (Bharathiyar Misquote)' : 'Bharathiyar Verse Masquerade',
      quote: 'ஒன்றுபட்டால் உண்டு வாழ்வே நம்மில்\nஒற்றுமை நீங்கில் அனைவர்க்கும் தாழ்வே',
      whyFake: lang === 'ta'
        ? 'மகாகவி பாரதியாரின் ஒற்றுமைப் பாடலை திருக்குறள் என AI தவறாக மேற்கோள் காட்டுகிறது.'
        : 'Mahakavi Bharathiyar modern nationalistic verse misattributed as an ancient couplet.',
      nearest: 'பாரதியார் கவிதைகள்',
      badge: '0% Match'
    },
    {
      id: 6,
      category: lang === 'ta' ? 'இணையக் கால போலி (Internet Anachronism)' : 'Modern Slang Perturbation',
      quote: 'பொருளல் லவரைப் பொருளாகச் செய்யும்\nபொருளல்ல தில்லை காசு',
      whyFake: lang === 'ta'
        ? 'குறள் 751-ல் வரும் "பொருள்" என்ற மரபுச் சொல்லுக்குப் பதிலாக தற்காலப் பேச்சுவழக்குச் சொல்லான "காசு" என்பதை AI மாற்றியுள்ளது.'
        : 'Replaced classical "பொருள்" (wealth) with modern colloquial slang "காசு" (cash).',
      nearest: 'குறள் #751: பொருளல் லவரைப் பொருளாகச் செய்யும் பொருளல்ல தில்லை பொருள்',
      badge: 'Altered 1 Word'
    }
  ];

  return (
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 font-sans">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <span>{t[lang].nav_detector}</span>
          <ShieldAlert className="w-6 h-6 text-orange-400" />
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 mt-1">
          {lang === 'ta'
            ? 'AI மொழியமைப்புகள் (LLMs) ஏன் போலியான தமிழ் மேற்கோள்களை உருவாக்குகின்றன? அவற்றின் நுட்பங்களை இங்கே ஆராயுங்கள்.'
            : 'How and why AI hallucinated quotations threaten Tamil cultural integrity, and how MeyKural shields against them.'}
        </p>
      </div>

      {/* Anatomy of an AI Tamil Hallucination Banner */}
      <div className="bg-[#0D1522]/90 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 mb-8 shadow-2xl text-stone-100">
        <h3 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-orange-400" />
          <span>{lang === 'ta' ? 'AI ஏன் போலி மேற்கோள்களை உருவாக்குகிறது?' : 'The Anatomy of Tamil AI Hallucination'}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-300">
          <div className="bg-[#070C15]/80 p-3.5 rounded-xl border border-white/10">
            <div className="font-bold text-white mb-1">1. Tokenizer Disconnect</div>
            <p className="opacity-90 leading-relaxed">
              Tamil letters decompose across subword tokens. LLMs predict plausible next tokens without checking classical canonical databases.
            </p>
          </div>
          <div className="bg-[#070C15]/80 p-3.5 rounded-xl border border-white/10">
            <div className="font-bold text-white mb-1">2. Venba Meter Blindness</div>
            <p className="opacity-90 leading-relaxed">
              AI mimics 7 words superficially, but fails the strict mathematical talas (Eerasaich seer, Venba rhythm) of Sangam prosody.
            </p>
          </div>
          <div className="bg-[#070C15]/80 p-3.5 rounded-xl border border-white/10">
            <div className="font-bold text-white mb-1">3. Lack of Grounded Truth</div>
            <p className="opacity-90 leading-relaxed">
              Standard chatbots answer questions by statistical probability, inventing fake citations with confidence rather than verifying.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Curated Hallucinations */}
      <div className="space-y-4">
        {fakeExamples.map((item) => (
          <div
            key={item.id}
            className="bg-[#0D1522]/90 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-xl hover:border-orange-500/50 transition-all text-stone-100"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
                {item.category}
              </span>
              <span className="text-xs font-mono font-bold text-rose-400">
                {item.badge}
              </span>
            </div>

            {/* Fake Quote */}
            <div className="text-center my-3 py-3 bg-[#070C15]/80 rounded-xl border border-rose-500/30">
              <div className="font-serif text-base sm:text-lg font-bold text-rose-200 leading-relaxed whitespace-pre-line">
                "{item.quote}"
              </div>
            </div>

            {/* Why Fake Explanation */}
            <div className="text-xs text-stone-300 space-y-1.5 mt-3 pt-2">
              <p>
                <strong className="text-orange-400">
                  {lang === 'ta' ? 'போலி என்பதற்கான சான்று:' : 'Hallucination Evidence:'}
                </strong>{' '}
                {item.whyFake}
              </p>
              <p className="text-stone-400">
                <strong className="text-stone-300">{lang === 'ta' ? 'அசல் தொடர்பு:' : 'Canonical Reference:'}</strong> {item.nearest}
              </p>
            </div>

            {/* Test in Verifier CTA */}
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => onSelectForVerify(item.quote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white active:scale-95 transition-all shadow-md shadow-orange-500/20"
              >
                <span>{lang === 'ta' ? 'சரிபார்ப்பியில் சோதனை செய்' : 'Test in Verifier'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
