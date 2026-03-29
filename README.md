# EduBot — Telegram Classroom & AI Tutor Platform

An AI-powered English proficiency test preparation platform built inside Telegram, combining a conversational bot for tutoring with a Mini App for practice tests and progress tracking.

## Architecture

- **Backend**: Python/FastAPI serving bot webhooks + REST API
- **Frontend**: React/Vite Telegram Mini App (WebApp)
- **AI**: Claude API (tutoring & scoring) + OpenAI Whisper (speech-to-text)
- **Database**: SQLite (dev) / PostgreSQL (prod)

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your API keys
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Supported Test Types
- TOEFL iBT (2026 format)
- IELTS (planned)

## Project Structure
```
edubot/
├── backend/     # Python/FastAPI
├── frontend/    # React/Vite Mini App
├── shared/      # Test configs
└── scripts/     # Deployment scripts
```
