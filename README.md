# 🎯 Numbers Guesser — Full-Stack Cloud Application

A modern, cloud-native **Numbers Guesser** web application built with **React, TypeScript, Tailwind CSS**, **Python FastAPI**, **Firebase Authentication**, and **Google Cloud Firestore**.

---

## 🏗️ Architecture Overview

- **Frontend**: React 18+ (Vite) + TypeScript + Tailwind CSS
- **Backend API**: Python 3.11+ + FastAPI + Pydantic v2
- **Authentication**: Firebase Authentication (Email/Password, Google OAuth, Guest Play)
- **Database**: Google Cloud Firestore (multi-tenant subcollections under `/users/{uid}/games/{gameId}`)
- **Hosting & Infrastructure**: Firebase Hosting (Global CDN Edge) + Google Cloud Run (Autoscaling Container Service)

For detailed architectural flow and token verification mechanics, see [`firebase_admin_auth.pdf`](../firebase_admin_auth.pdf) and [`plan.md`](../plan.md).

---

## 📁 Repository Structure

```
numbers-guesser/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory & CORS configuration
│   │   ├── config.py                # Environment settings & Pydantic config
│   │   ├── dependencies.py          # Firebase Bearer JWT authentication validator
│   │   ├── routers/
│   │   │   ├── games.py             # Game session start, guess evaluation, active game, history
│   │   │   └── stats.py             # Player aggregate win rate and streaks
│   │   ├── schemas/
│   │   │   └── game.py              # Pydantic request and response schemas
│   │   └── services/
│   │       ├── firebase_service.py  # Firestore client with ADC, ServiceAccount, & in-memory fallback
│   │       └── game_engine.py       # Random number generation & logic evaluation
│   ├── tests/                       # Unit tests & API integration test suite
│   ├── Dockerfile                   # Production container for Google Cloud Run
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/AuthModal.tsx   # Login, Sign Up, Google OAuth, Guest mode
│   │   │   ├── game/GameBoard.tsx   # Number input, dynamic feedback, confetti celebration
│   │   │   ├── stats/StatsModal.tsx # Win stats, history table, attempt counters
│   │   │   └── Navbar.tsx           # App header, user profile, auth triggers
│   │   ├── context/AuthContext.tsx  # Reactive Firebase authentication state & token provider
│   │   ├── services/
│   │   │   ├── api.ts               # Axios / Fetch client with Bearer auth injection
│   │   │   └── firebase.ts          # Firebase Web Client SDK initialization
│   │   ├── App.tsx
│   │   └── index.css                # Tailwind directives
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── firebase.json                    # Firebase Hosting CDN + Emulator suite configuration
├── .firebaserc                      # Firebase project ID mapping
├── deploy.sh                        # End-to-end Google Cloud Run & Firebase Hosting deployment script
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### The Fast Way (Single Command)
Run both backend and frontend concurrently with live reloading:
```bash
./start-dev.sh
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Manual Setup (Separate Terminals)

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend development server
uvicorn app.main:app --reload --port 8000
```
API Documentation (Swagger UI) is available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend application is available at: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Running Tests

### Backend Unit & API Tests:
```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

### Frontend Build Verification:
```bash
cd frontend
npm run build
```

---

## ☁️ Deployment to Google Cloud

Ensure you have authenticated with the Google Cloud and Firebase CLIs:
```bash
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>
firebase login
```

Run the automated deployment script:
```bash
./deploy.sh
```
This builds and deploys the FastAPI container to **Google Cloud Run** and uploads the React build to **Firebase Hosting** with automatic `/api/**` URL routing.
