# LexAssist

**AI-powered, multilingual legal assistant for Indian law.**

LexAssist gives people instant, plain-language guidance on Indian law — through domain-specialized chat, document analysis, a self-representation guide, and an AI-simulated virtual courtroom — in their preferred language, free of cost.

## Features

- **Legal chat assistants** — retrieval-augmented chat (Pinecone + Groq) specialized by domain:
  - *Personal & Family Legal Assistance* — marriage, divorce, adoption, tenancy, wills, property disputes, protection orders
  - *Business, Consumer & Criminal Legal Assistance* — business formation, IP, consumer complaints, criminal defense, civil litigation
- **Self Lawyer Guide** — step-by-step help to represent yourself in court: document prep, argument structuring, court procedure.
- **Virtual Courtroom** — an interactive trial simulation with an AI judge and AI opposing counsel, real-time objections, and feedback on your arguments. *(Educational simulation only — not legal advice.)*
- **Document Analyser** — upload or paste a legal document/form and get a plain-language summary, field-by-field guidance, and deadline highlights. Includes OCR for scanned images (English and Malayalam, with automatic script/orientation detection).
- **Voice & multilingual support** — text-to-speech responses and i18n coverage across Indian languages, with automatic language detection.
- **Accounts & history** — Supabase-backed auth, per-service chat history, and smart reminders.

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Framer Motion, Radix UI, React Three Fiber/Drei, react-i18next |
| Main backend (`Server/`) | Flask, Pinecone (vector search), Groq (LLM), Sentence-Transformers, Supabase, Tesseract OCR (`pytesseract`), PyMuPDF, gTTS |
| Virtual Courtroom service (`virtual_court/`) | FastAPI, WebSockets, Groq, PyMuPDF/pytesseract for evidence uploads |

## Project Structure

```
LexAssist/
├── App/project/           # React + Vite frontend
│   └── src/
│       ├── components/    # Shared UI: chat, self-lawyer toolkit, language select
│       ├── courtroom/     # Virtual Courtroom UI + WebSocket client
│       └── ...            # Landing, services, auth, resources pages
├── Server/                # Main Flask API — chat, document analyser, TTS, reminders
│   └── tessdata/          # Tesseract language data (eng, mal, osd)
└── virtual_court/
    └── virtual_court/
        ├── backend/       # FastAPI service: judge/opposing-lawyer agents, state machine
        └── frontend/      # Legacy standalone demo UI (superseded by App/project/src/courtroom)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed and on your `PATH` (for document image analysis)
- API keys/accounts: [Pinecone](https://www.pinecone.io/), [Groq](https://groq.com/), [Supabase](https://supabase.com/)

### 1. Clone

```bash
git clone https://github.com/shreyeahhhh/LexAssist.git
cd LexAssist
```

### 2. Main backend (`Server/`)

```bash
cd Server
pip install -r requirements.txt
```

Create `Server/.env`:

```env
PINECONE_API=your_pinecone_api_key
PINECONE_ENV=us-east-1
GROQ_API=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run it:

```bash
python app.py
```

The API runs on `http://127.0.0.1:5000`. (Additional optional tuning variables are documented at the top of `Server/app.py`.)

### 3. Virtual Courtroom service (`virtual_court/`)

```bash
cd virtual_court/virtual_court/backend
pip install -r requirements.txt
```

Create a `.env` in that folder:

```env
GROQ_API_KEY=your_groq_api_key
```

Run it:

```bash
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd App/project
npm install
```

Create `App/project/.env`:

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional — only needed if the courtroom service isn't on localhost:8000
VITE_COURT_WS_URL=ws://127.0.0.1:8000
```

Run it:

```bash
npm run dev
```

The app runs on `http://localhost:5173`.

## Deployment

- `Server/` ships with a `Dockerfile`, a `Procfile` (gunicorn), and a `vercel.json` — deploy it as a container, on any Procfile-based host, or on Vercel.
- The frontend is a static Vite build (`npm run build`), deployable to Vercel, Netlify, or any static host.

## Disclaimer

LexAssist provides general legal information and educational simulations, not legal advice. The Virtual Courtroom and Self Lawyer Guide are practice tools; they do not create an attorney-client relationship. For an actual legal matter, consult a licensed attorney in your jurisdiction.

## License

Licensed under the [MIT License](./LICENSE).

## Author

**Shreya Merin Mathew** — [@shreyeahhhh](https://github.com/shreyeahhhh)
