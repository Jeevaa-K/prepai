<div align="center">

# ⚡ PrepAI — AI-Powered Interview Training

**Practice interviews with AI. Get expert feedback on every answer — instantly.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3%2070B-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/yourusername/prepai/pulls)

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🛠️ Tech Stack](#️-tech-stack) · [📡 API](#-api-reference) · [🤝 Contributing](#-contributing)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **12 Job Roles** | Software Engineer, PM, Data Scientist, UX Designer, DevOps, and more |
| 📊 **4-Dimension Scoring** | Every answer scored on Clarity, Depth, Relevance & Structure |
| 🎙️ **Voice + Text Input** | Answer via typing or live speech-to-text (Chrome/Edge) |
| 💡 **Smart Hints** | Per-question guidance without spoiling the answer |
| ⭐ **Model Answers** | See best-in-class answers after each submission |
| 📈 **Session Analytics** | Average scores across all dimensions at session end |
| 🏷️ **4 Difficulty Levels** | Entry, Mid, Senior, Staff/Lead |
| 🔄 **Retry Answers** | Not happy? Reattempt any question before moving on |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- A [Groq API key](https://console.groq.com) (free)

### 1 — Clone the repository

```bash
git clone https://github.com/yourusername/prepai.git
cd prepai
```

### 2 — Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and add your Groq key:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
PORT=3001
```

### 3 — Start the API server

```bash
npm start
# → PrepAI API running on http://localhost:3001
```

### 4 — Open the frontend

Open `frontend/index.html` directly in your browser.

> **Note:** No build step required — the frontend is plain HTML/CSS/JS.

---

## 📁 Project Structure

```
prepai/
├── .gitignore
├── README.md
├── backend/
│   ├── server.js          # Express API server (Groq integration)
│   ├── package.json
│   └── .env.example       # Environment variable template
└── frontend/
    ├── index.html          # Single-page application
    ├── css/
    │   └── style.css       # Full design system & animations
    └── js/
        └── app.js          # Application logic & state management
```

---

## 📡 API Reference

Base URL: `http://localhost:3001`

### `GET /api/health`
Returns server status and model info.

### `GET /api/roles`
Returns the list of available job roles.

### `POST /api/generate-questions`
Generate a set of interview questions.

**Body:**
```json
{
  "role"       : "Software Engineer",
  "difficulty" : "mid-level",
  "count"      : 5
}
```

**Response:**
```json
{
  "role"      : "Software Engineer",
  "difficulty": "mid-level",
  "count"     : 5,
  "questions" : [
    {
      "id"       : 1,
      "question" : "Tell me about a time you had to make a technical decision under uncertainty...",
      "type"     : "behavioral",
      "category" : "Decision Making",
      "hint"     : "Focus on your reasoning process and how you validated assumptions.",
      "timeGuide": "2–3 minutes"
    }
  ]
}
```

### `POST /api/analyze-answer`
Analyse a candidate's answer with detailed feedback.

**Body:**
```json
{
  "role"        : "Software Engineer",
  "question"    : "Tell me about a system you designed...",
  "questionType": "technical",
  "answer"      : "In my last role, I designed a..."
}
```

**Response:**
```json
{
  "overallScore": 78,
  "verdict"     : "Strong",
  "summary"     : "Solid answer with good technical depth...",
  "scores": {
    "clarity"  : { "score": 82, "label": "Clarity & Communication", "feedback": "..." },
    "depth"    : { "score": 75, "label": "Depth & Technical Detail", "feedback": "..." },
    "relevance": { "score": 80, "label": "Relevance & Focus",        "feedback": "..." },
    "structure": { "score": 74, "label": "Structure & Flow",         "feedback": "..." }
  },
  "strengths"   : ["Strong use of concrete metrics", "Clear problem framing"],
  "improvements": ["Could elaborate on trade-offs considered", "..."],
  "modelAnswer" : "An exceptional answer would...",
  "keywords"    : ["scalability", "CAP theorem", "eventual consistency"]
}
```

### `POST /api/followup`
Generate a follow-up probe question.

**Body:**
```json
{
  "role"    : "Software Engineer",
  "question": "...",
  "answer"  : "..."
}
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **AI Model:** LLaMA 3.3 70B via Groq API
- **Rate Limiting:** express-rate-limit

### Frontend
- **Vanilla HTML / CSS / JavaScript** — no framework, no build step
- **Fonts:** Bebas Neue · JetBrains Mono · Outfit (Google Fonts)
- **Voice:** Web Speech API
- **Animations:** Pure CSS keyframes

---

## 🔧 Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | ✅ Yes | — | Your Groq API key |
| `PORT` | No | `3001` | Port for the Express server |

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © 2025 — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ⚡ and the <a href="https://groq.com">Groq API</a>
</div>
