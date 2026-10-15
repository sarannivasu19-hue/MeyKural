# 🌿 மெய்க்குறள் (Meikkural)
### AI Hallucination Shield for Classical Tamil Literature
**Tamil Hackathon 2026 — Problem P15 Solution**  
*"How would you prevent AI from generating false literary quotations in Tamil?"*

---

## ⚡ 3 Commands to Run

```bash
# 1. Clone repository
git clone https://github.com/sarannivasu19-hue/MeyKural.git
cd MeyKural

# 2. One-command automated setup (validates 1,330 kurals, builds SQLite & embeddings)
npm run setup

# 3. Launch dev server (prints Local & LAN Wi-Fi URLs for phone testing)
npm run dev
```

> **Other Handy Commands:**
> - `npm run evaluate` — Runs the complete 8-category Feature Scorecard across 200 samples with 100% test integrity.
> - `npm test` — Executes unit test suite for strict verifier, game integrity, meter checking, and diff highlighter.
> - `npm run build` & `npm start` — Builds client and serves production bundle.

---

## 🎯 Strict Verification Rules (Zero Guesswork)

The ONLY source of truth is the 1,330 couplets. Verification is deterministic code, NEVER an LLM or embeddings.

There are exactly THREE outcomes:
1. **VERIFIED**: Exact match after Unicode normalization. Displays couplet number, adhikaram, section, and authentic commentaries (Mu. Varadarajanar, Solomon Pappaiah, English translation).
2. **NEAR MATCH**: All words match ONE real couplet except at most 2 words (`MAX_WRONG_WORDS=2`). Labeled *"Incorrect, needs correction"* (தவறானது, திருத்தம் தேவை). Highlights each wrong word next to its correct canonical word and reveals the corrected couplet with its number and chapter.
3. **NOT FOUND**: Anything else. Shows only: *"Not found. This kural does not exist in the 1,330 Tirukkural couplets."* Does NOT invent or assume a meaning, does NOT explain around it, and does NOT suggest similar kurals.

---

## 🏛️ System Features & Architectural Upgrades

- **Typography & Font Stack**: Self-hosted `Times New Roman` serif for English, paired with `@fontsource/noto-serif-tamil` for authentic Tamil glyphs with `1.7` line-height. 100% offline-ready without CDN dependencies.
- **4 + 3 Input Format**: Two dedicated fields for Line 1 (4 words) and Line 2 (3 words) with live word-count badges (`3/4`, `2/3`). Auto-splits full couplets pasted with newlines or 7 words. Verification is enabled strictly when 4+3 format is satisfied.
- **On-Device Camera OCR**: Guide frame scanner with on-device canvas preprocessing (grayscale, contrast, binarization thresholding) via Tesseract.js.
- **AI Hallucination Report & AI Lie Test**:
  - Drops pseudo-scientific stylometry; tags user source AI ("Where did you get this kural?").
  - Automated 20 standard prompts Lie Test ("Give a Tirukkural couplet about <topic>") per configured provider to chart honest fabrication rates.
- **Kural Police Game**: Samples 10 DISTINCT couplets without replacement per round using Fisher-Yates shuffle with `crypto.getRandomValues`. Generates fakes dynamically at runtime, highlights changed words, and tracks streaks and local leaderboards.
- **Valluvar RAG Chatbot**: Local SQLite retrieval first; strict system prompt forbidding guessing; self-verifies every quoted kural in answers; offline retrieval mode fallback.
- **Responsive Layout**: Mobile-first design (320px, 375px, 768px, 1024px, 1440px), fixed bottom navigation on mobile, left sidebar on desktop, fluid `clamp()` sizing, and touch targets ≥ 44px.
- **Authentication & Admin Control Room**:
  - User and Admin login toggle, bcrypt password hashing, JWT in `httpOnly` cookie, and rate-limiting (lock 1 min after 5 failures).
  - Searchable verification logs with CSV export, settings manager (`MAX_WRONG_WORDS`, LLM provider), dataset health status, and user management.

---

## 📄 License
MIT License. Created for Tamil Hackathon 2026.
