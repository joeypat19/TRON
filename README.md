# TRON — FastAPI + Next.js starter

TRON is a small full-stack starter with a FastAPI backend and a Next.js App Router frontend.

## Structure

```text
backend/    FastAPI service
frontend/   Next.js + TypeScript UI
```

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 938
```

The API is available at `http://localhost:938` and its OpenAPI docs are at `http://localhost:938/docs`.

`GET /api/search?q=github&page=1&limit=10` searches the locally stored SQLite corpus. It does not call Brave or add new indexed data.

### Frontend

```powershell
cd frontend
npm install
npm run dev -- --port 2343
```

Open `http://localhost:2343`.

The frontend defaults to `http://localhost:8000`. To point it elsewhere, create `frontend/.env.local`:

```env
BACKEND_URL=http://localhost:938
```

### TRON desktop app

The Electron desktop shell gives TRON its own window, tabs, URL bar, navigation controls, and in-app website loading.

Start it against the local frontend:

```powershell
cd desktop
$env:TRON_START_URL="http://127.0.0.1:2343"
npm start
```

Build a Windows installer:

```powershell
cd desktop
$env:NODE_OPTIONS="--use-system-ca"
npm run dist -- --x64
```

The installer is written to `desktop/dist/`. The current preview build defaults to the local frontend at `http://127.0.0.1:2343`; set `TRON_START_URL=https://search.tronxvi.com` after the public deployment is live.

