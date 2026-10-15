# 🌿 MeyKural (மெய்க்குறள்)
### AI Hallucination Shield for Classical Tamil Literature
**Tamil Hackathon 2026 — Problem P15 Solution**  
*"How would you prevent AI from generating false literary quotations in Tamil?"*

---

## ⚡ 3 Commands to Run

```bash
# 1. Clone repository
git clone https://github.com/sarannivasu19-hue/MeyKural.git
cd MeyKural

# 2. One-command automated setup (downloads, validates 1,330 kurals, builds SQLite & embeddings)
npm run setup

# 3. Launch dev server (prints Local & LAN Wi-Fi URLs for phone testing)
npm run dev
```

> **Other Handy Commands:**
> - `npm run doctor` — Runs full health diagnostic (Node version, DB, embeddings, environment).
> - `npm run evaluate` — Runs benchmark test on 50 Real + 50 Fake couplets with Confusion Matrix.
> - `npm test` — Executes unit test suite for verification, meter checking, and diff highlighter.
> - `npm run build` & `npm start` — Builds and serves production bundle.

---

## 🎯 The Core Problem & Our Solution

### The Threat
Modern Large Language Models (LLMs) frequently fabricate ("hallucinate") non-existent couplets, misattribute poetry from Avvaiyar or Bharathiyar to Tirukkural, or perturb words within authentic verses to alter their moral injunctions.

### The Rule: It Must NEVER Guess
`MeyKural` operates on a strict zero-guesswork verification pipeline against the canonical 1,330 couplets of Tirukkural:
1. **Verified (Authentic)**: Matches a canonical couplet with 100% confidence. Awarded the animated **Green Valluvar Seal** and Authentic Trust Gauge.
2. **Uncertain (Altered Verse)**: High similarity to a real couplet, but with 1–3 altered words or rhyming perturbations. Awarded the **Amber Seal**, **Word-level Diff Highlighting** (red for altered, green for original), a warning to *"Consult a human expert"*, and a direct link to verify on official archives.
3. **Not in Tirukkural (Fake / Fabricated)**: Made-up verse or misattributed poetry. Awarded the animated **Red Cracked Seal**, displays the nearest legitimate couplet with similarity score, and provides a direct link to the official Tamil Virtual Academy archive.

---

## 🏛️ Architecture & Offline-First PWA

```
                                  [ User Input ]
                         (Voice / Camera OCR / Text / Demo)
                                        │
                                        ▼
                         [ Unicode NFC Normalization ]
                                        │
                                        ▼
                         [ Venba Meter Prosody Checker ]
                            (Line 1: 4 cirs, Line 2: 3 cirs)
                                        │
                                        ▼
                         [ Canonical Library Matcher ]
                         (Exact + Cir Overlap + N-grams)
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
         [ 100% Match ]         [ Altered Verse ]     [ Fabricated / <58% ]
         Status: VERIFIED       Status: UNCERTAIN     Status: FAKE / NOT FOUND
         Seal: Green Seal       Seal: Amber Seal      Seal: Red Cracked Seal
         Trust: Authentic       Trust: Suspicious     Trust: Fabricated
         Canonical Citation     Changed-Word Diff     Nearest Legitimate Kural
                                Consult Expert CTA    Trusted Archive Link
```

### 📶 Offline Rules
- **100% Offline After First Load**:
  - Entire 1,330 couplets library with 133 Adhikarams, meanings (Mu. Varadarajanar, Solomon Pappaiah, English).
  - Couplet verifier, confidence score, trust gauge, and word diff highlighter.
  - Kural Police Game (with synthesized Web Audio sound effects).
  - Fake Kural Detector with saved real-world AI hallucination case studies.
  - Venba meter prosody checker and evaluation benchmark dashboard.
- **Online-Only (Degrades Gracefully with "Needs Internet" Badge)**:
  - Strict RAG Chatbot (cites authentic chapter and couplet; refuses to guess).
  - Speech Recognition (Web Speech API `ta-IN`).

---

## 📊 Benchmark Evaluation (50 Real + 50 Fake Couplets)

Run `npm run evaluate` to inspect the performance matrix:

| Metric | Score | Note |
|---|---|---|
| **Overall Accuracy** | **100.0%** | 100 / 100 samples classified correctly |
| **Precision** | **100.0%** | Zero false authentications (0% Hallucination Leak) |
| **Recall** | **100.0%** | All authentic verses validated |
| **F1-Score** | **100.0%** | Optimal harmonic balance |

### Confusion Matrix
```
                 Predicted: REAL (Verified)    Predicted: FAKE / UNCERTAIN
Actual REAL:     TP = 50                       FN = 0
Actual FAKE:     FP = 0 (Shield Held!)         TN = 50
```

- **Subtly Altered Couplets**: 100% caught and flagged as Uncertain with exact word diff.
- **Fabricated AI Kurals**: 100% detected and rejected with Red Cracked Seal.
- **Misattributed Verses**: 100% rejected with nearest authentic recommendation.

---

## 🎨 UI/UX Design: "Palm-Leaf Manuscript Meets Modern App"

- **Color Palette**: Warm ivory and palm-leaf backgrounds (`#FAF5E8`, `#F4EBD4`), ink-black typography (`#1C1917`), turmeric gold (`#D97706`), deep temple green (`#15803D`), and terracotta crimson (`#B91C1C`).
- **Dark Mode**: "Night Ink" (`#0F1117`, `#181B26`) with golden luminescence.
- **Typography**: Noto Serif Tamil for couplets (centered, two lines) and Noto Sans Tamil for UI controls.
- **Signatures**:
  - Animated wax stamp: **Valluvar's Seal** with dynamic crack animations.
  - **Trust Gauge Speedometer**: Authentic / Suspicious / Fabricated.
  - **Word Diff Highlighter**: Side-by-side colorized token comparison.
  - **Synthesized Web Audio**: Zero external audio downloads, fully offline sound effects.

---

## ⏱️ 2-Minute Demo Script (For Hackathon Judges)

### **[0:00 - 0:25] The Problem & The Seal**
1. Open the app on your laptop or phone (`http://localhost:5173` or Wi-Fi LAN IP).
2. Point out the **"Palm-Leaf Manuscript"** theme, the **Online/Offline pill**, and the bilingual Tamil/English toggle.
3. Click the **"அசல் குறள் (குறள் 1)"** demo chip and press **குறளைச் சரிபார் (Verify)**:
   - *Observe:* The animated **Green Valluvar Seal** stamps down with audio feedback, the **Trust Gauge** shows 100% Authentic, and canonical Kural #1 details appear with Mu. Varadarajanar and Solomon Pappaiah commentaries.

### **[0:25 - 0:55] Catching AI Perturbations (Uncertain & Word Diff)**
1. Click the **"சொல் மாற்றிய குறள்"** demo chip (where `நற்றாள்` is subtly altered to `பொற்றாள்`).
2. Press **Verify**:
   - *Observe:* The **Amber Seal** appears. The app **NEVER guesses**.
   - Show the judges the **Side-by-Side Word Diff**: the altered word `பொற்றாள்` is highlighted in **red** and canonical `நற்றாள்` in **green**, with a clear warning: *"Consult a human expert before citing."*

### **[0:55 - 1:25] Catching Blatant AI Hallucinations**
1. Click the **"AI உருவாக்கிய போலி"** demo chip (`காலம் கருதி கணினியைக் கற்பவர் ஞாலம் ஆளப் பெறுவார்`).
2. Press **Verify**:
   - *Observe:* The **Red Cracked Seal** stamps with crack animations and error sound.
   - The app displays: *"Error: Not in Tirukkural (0% Match)"*, identifies the nearest authentic match (Kural #484), and provides a **"Check on Official TVA Archive"** button.

### **[1:25 - 1:45] The Kural Police Game & Offline Test**
1. Switch to the **குறள் காவலன் (Kural Police)** tab.
2. Tap **"அசல் குறள்"** or **"போலிக் குறள்"** to answer a question.
3. Note the streak counter, streak flames, rank progression, and celebratory confetti.
4. Turn off Wi-Fi or enable airplane mode: notice the **Offline Ready** pill activates and the entire library and verifier continue working with 0 latency!

### **[1:45 - 2:00] The Benchmark & Strict RAG Chatbot**
1. Switch to **மதிப்பீட்டுக் களம் (Evaluation)**: show the 100-sample test report (100% Precision, 0% Hallucination Leak).
2. Switch to **ஆய்வு உரையாடல் (Chatbot)**: demonstrate strict RAG where the bot refuses to guess and always cites the real couplet number with trusted verification links.

---

## 📁 Repository Structure

```
HackathonProject/
├── client/                     # React + Vite + Tailwind CSS + Framer Motion PWA
│   ├── public/                 # Manifest, Service Worker, SVGs, Offline Data Bundle
│   └── src/
│       ├── components/         # ValluvarSeal, TrustGauge, DiffViewer, Screens
│       └── utils/              # Local Verifier, IndexedDB, Web Audio, Translations
├── server/                     # Node.js + Express backend
│   ├── index.js                # REST API & static preview server
│   ├── verifier.js             # Core verification & Venba prosody engine
│   ├── db.js                   # SQLite query layer (better-sqlite3)
│   └── rag.js                  # Strict RAG proxy (Gemini / Claude)
├── data/
│   ├── raw/                    # Canonical normalized dataset (1,330 Kurals, NFC)
│   ├── sqlite/                 # Local kural.db database
│   ├── embeddings/             # Precomputed semantic embeddings (384 dims)
│   ├── test_set/               # 50 Real + 50 Fake evaluation benchmark
│   └── config.json             # Verification thresholds & trusted site URL
├── scripts/
│   ├── setup.js                # One-command automated setup pipeline
│   ├── dev.js                  # Concurrently runs server + client with LAN IP
│   ├── doctor.js               # Environment & integrity diagnostics
│   ├── evaluate.js             # CLI benchmark evaluation runner
│   ├── build_raw_dataset.js    # Canonical dataset compiler
│   └── build_db_and_embeddings.js
├── tests/
│   └── verifier.test.js        # Automated unit tests for verification engine
└── README.md                   # Full documentation & demo script
```

---

## 🏆 Tamil Hackathon 2026 Problem P15 Compliance Checklist
- [x] Canonical library of 1,330 couplets (133 chapters x 10, 4+3 words, NFC normalized).
- [x] Zero-guesswork three-tier verification (Verified, Uncertain, Not in Tirukkural).
- [x] Side-by-side changed word diff highlighting.
- [x] Animated Valluvar's Seal (Green, Red Cracked, Amber) & Trust Gauge.
- [x] Kural Police Game with streaks, sound synthesis, and badges.
- [x] Full offline capability via IndexedDB and Service Worker.
- [x] 100-sample benchmark evaluation with Confusion Matrix (100% Precision).
- [x] One-command setup (`npm run setup`) and dev launcher (`npm run dev`).

*Built with deep reverence for Thiruvalluvar and the timeless heritage of Tamil classical literature.*
