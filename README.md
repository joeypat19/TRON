# TRON — downloadable desktop app

TRON is a downloadable Windows desktop app. Its FastAPI service is an internal
API for the Electron app and does not serve a TRON website, HTML pages, API
documentation, or OpenAPI routes.

## Structure

```text
backend/    Internal API used by the desktop app
desktop/    Downloadable Electron app and TRON UI
inbox/      Separate web application; this is the only website in the repo
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

The internal API is available at `http://localhost:938` for the desktop app.
TRON does not expose a website or API documentation route.

General Chat is embedded in the desktop app at the internal `tron://infinity`
route. Its FastAPI bridge forwards the `general_chat.request.v2` SSE contract
to Infinity. Set `TRON_INFINITY_CHAT_URL` to override the upstream endpoint and
`TRON_INFINITY_ACCESS_TOKEN` when the upstream requires an access token. These
values belong in the local runtime environment and must not be committed.

`GET /api/search?q=github&page=1&limit=10` searches the locally stored SQLite corpus. It does not call Brave or add new indexed data.

The desktop URL toolbar also includes a shared 20-symbol market ticker. The
backend caches one snapshot for 20 minutes so clients see the same values
instead of each client making its own request. It uses Twelve Data when the
configured local `TWELVE_DATA_API_KEY` permits the batch request, then falls
back to Yahoo Finance's public chart metadata endpoint when that provider is
unavailable or quota-limited. The fallback is still cached centrally and does
not require another key. Provider keys belong only in the local runtime and
must never be committed.

### Optional crawler

The crawler is disabled unless `TRON_CRAWLER_ENABLED=true` is configured. Ten workers share one SQLite frontier and storage index; atomic claims, worker leases, canonical URL uniqueness, and restart recovery prevent duplicate work. Per-domain politeness limits keep concurrency bounded even when more workers are available. The main tuning variables are:

```env
TRON_CRAWLER_ENABLED=true
TRON_CRAWLER_WORKERS=10
TRON_CRAWLER_PER_DOMAIN_CONCURRENCY=2
TRON_CRAWLER_DELAY_SECONDS=1.0
TRON_CRAWLER_LEASE_SECONDS=300
TRON_CRAWLER_MAX_DEPTH=3
TRON_CRAWLER_MAX_LINKS_PER_PAGE=2000
TRON_CRAWLER_MAX_QUEUE_SIZE=250000
```

Start and stop it with `POST /api/crawler/start` and `POST /api/crawler/stop`. Sitemap results and public-host DNS checks are cached, redirects are validated, and interrupted queue items are recovered on the next run.

### TRON desktop app

The Electron desktop app owns the TRON home page, search results, tabs, URL bar, navigation controls, and in-app website loading. Search requests go directly to the local backend.

Start it against the local backend:

```powershell
cd desktop
npm start
```

Build a Windows installer:

```powershell
cd desktop
$env:NODE_OPTIONS="--use-system-ca"
npm run dist -- --x64
```

The installer is written to `desktop/dist/`.

### Release workflow

The desktop app reads the current workspace in development and checks the
GitHub release feed only when packaged. Every published release must use a tag
that matches `desktop/package.json`:

```powershell
cd desktop
npm ci
npm run verify
cd ..
$version = (Get-Content desktop\package.json | ConvertFrom-Json).version
git tag "v$version"
git push origin main --tags
```

The `release-tron.yml` workflow validates the version, writes build identity
metadata, creates the Windows NSIS installer, and publishes the installer,
`latest.yml`, and blockmap. Installed TRON clients then discover the release
through `electron-updater`.

Local modified builds are marked dirty in `desktop/build-info.json`. Their
automatic and manual official-update paths stay disabled so an upstream
installer cannot overwrite local changes. A clean packaged release re-enables
the normal updater.

The home screen shows the running version and commit so local, packaged, and
published builds can be distinguished immediately.

