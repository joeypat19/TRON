import json
import hashlib
import ipaddress
import re
import sqlite3
import socket
import threading
import time
from collections import OrderedDict
from copy import deepcopy
from contextlib import closing
from datetime import datetime, timezone
from difflib import SequenceMatcher
from html.parser import HTMLParser
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from .crawler import (
    CRAWLER_ENABLED,
    CRAWL_PAGES_FTS_TABLE,
    crawler_status,
    enqueue_urls,
    initialize_crawler_database,
    runtime as crawler_runtime,
)
from .chat import ChatRequest, stream_chat


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
DATABASE_PATH = DATA_DIR / "tron_search.sqlite3"
FTS_TABLE = "search_results_fts"
SEARCH_FTS_FIELDS = ("source_query", "title", "url", "description")
CRAWL_FTS_FIELDS = ("title", "url", "description", "headings", "content")
FAVICON_TABLE = "favicon_cache"
FAVICON_MAX_BYTES = 256 * 1024
FAVICON_CACHE_SECONDS = 30 * 24 * 60 * 60
FAVICON_FAILURE_CACHE_SECONDS = 7 * 24 * 60 * 60
FAVICON_REFRESHING: set[str] = set()
FAVICON_REFRESHING_LOCK = threading.Lock()
SEARCH_CANDIDATE_LIMIT = 500
SEARCH_CACHE_TTL_SECONDS = 30
SEARCH_CACHE_MAX_ENTRIES = 128
SEARCH_CACHE: OrderedDict[tuple[str, int, int], tuple[float, "SearchResponse"]] = OrderedDict()
SEARCH_CACHE_LOCK = threading.Lock()
SEARCH_CONNECTION_LOCAL = threading.local()
INDEX_REBUILD_NEEDED = False
FAVICON_MIME_TYPES = {
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/vnd.microsoft.icon",
    "image/webp",
    "image/x-icon",
}
FALLBACK_GLOBE_SVG = b'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="32" fill="#3c4043"/>
<circle cx="32" cy="32" r="18" fill="none" stroke="#9aa0a6" stroke-width="3"/>
<path d="M14 32h36M32 14c6 5 9 11 9 18s-3 13-9 18c-6-5-9-11-9-18s3-13 9-18Z" fill="none" stroke="#9aa0a6" stroke-width="2.5"/>
</svg>'''


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime


class Metric(BaseModel):
    label: str
    value: str
    change: str
    tone: str


class MetricsResponse(BaseModel):
    metrics: list[Metric]
    activity: list[str]


class SearchResult(BaseModel):
    rank: int
    title: str
    url: str
    description: str | None = None
    age: str | None = None
    domain: str
    display_url: str
    source_query: str
    collected_at: datetime


class TimeToolResponse(BaseModel):
    tool: str
    location: str
    timezone: str
    abbreviation: str
    time: str
    date: str
    iso: datetime


class SearchResponse(BaseModel):
    query: str
    page: int
    limit: int
    result_count: int
    has_previous: bool
    has_next: bool
    results: list[SearchResult]
    tool: TimeToolResponse | None = None
    corrected_query: str | None = None


class CrawlerSeedsRequest(BaseModel):
    urls: list[str]
    depth: int = 0


class CrawlerStartRequest(BaseModel):
    discover_links: bool = False


class StoredResultItem:
    def __init__(
        self,
        *,
        result_type: str,
        result_path: str,
        position: int,
        value: Any,
    ) -> None:
        self.result_type = result_type
        self.result_path = result_path
        self.position = position
        self.value = value

    @property
    def title(self) -> str | None:
        return self.value.get("title") if isinstance(self.value, dict) else None

    @property
    def url(self) -> str | None:
        return self.value.get("url") if isinstance(self.value, dict) else None

    @property
    def description(self) -> str | None:
        return self.value.get("description") if isinstance(self.value, dict) else None

    @property
    def age(self) -> str | None:
        return self.value.get("age") if isinstance(self.value, dict) else None

    @property
    def raw_result(self) -> str:
        return json.dumps(self.value, ensure_ascii=False, separators=(",", ":"))


class FaviconLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "link":
            return
        attributes = {name.lower(): value for name, value in attrs}
        href = attributes.get("href")
        rel = {part.lower() for part in (attributes.get("rel") or "").split()}
        if not href or not rel.intersection({"icon", "shortcut", "apple-touch-icon", "apple-touch-icon-precomposed"}):
            return
        priority = 0 if "icon" in rel else 1 if "shortcut" in rel else 2
        self.links.append((priority, href))


app = FastAPI(
    title="TRON API",
    version="0.2.0",
    description="Internal API used by the downloadable TRON desktop app.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def database_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=30000")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=FULL")
    return connection


def search_database_connection() -> sqlite3.Connection:
    """Return one read-optimized SQLite connection per FastAPI worker thread."""
    connection = getattr(SEARCH_CONNECTION_LOCAL, "connection", None)
    if connection is not None:
        try:
            connection.execute("SELECT 1")
            return connection
        except sqlite3.Error:
            SEARCH_CONNECTION_LOCAL.connection = None

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    connection.execute("PRAGMA busy_timeout=5000")
    connection.execute("PRAGMA cache_size=-65536")
    connection.execute("PRAGMA temp_store=MEMORY")
    connection.execute("PRAGMA mmap_size=268435456")
    SEARCH_CONNECTION_LOCAL.connection = connection
    return connection


def initialize_database() -> None:
    with closing(database_connection()) as connection, connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS search_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT UNIQUE,
                query TEXT NOT NULL,
                requested_at TEXT NOT NULL,
                brave_status_code INTEGER NOT NULL,
                response_sha256 TEXT,
                raw_response_bytes INTEGER,
                brave_result_count INTEGER,
                stored_result_count INTEGER,
                raw_response BLOB NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS search_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                result_type TEXT NOT NULL,
                result_path TEXT NOT NULL,
                position INTEGER NOT NULL,
                title TEXT,
                url TEXT,
                description TEXT,
                age TEXT,
                raw_result TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES search_runs(id)
            )
            """
        )

        # Upgrade the schema created by the first implementation without
        # deleting any stored search data. New installations already have the
        # complete schema above; this path is for an older local database.
        run_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(search_runs)")
        }
        for name, definition in (
            ("request_id", "TEXT"),
            ("response_sha256", "TEXT"),
            ("raw_response_bytes", "INTEGER"),
            ("brave_result_count", "INTEGER"),
            ("stored_result_count", "INTEGER"),
        ):
            if name not in run_columns:
                connection.execute(
                    f"ALTER TABLE search_runs ADD COLUMN {name} {definition}"
                )

        result_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(search_results)")
        }
        if "raw_result" not in result_columns:
            existing_count = connection.execute(
                "SELECT COUNT(*) FROM search_results"
            ).fetchone()[0]
            if existing_count:
                raise RuntimeError(
                    "The legacy search_results table contains data and needs a "
                    "one-time migration before new searches can be stored."
                )
            connection.execute("DROP TABLE search_results")
            connection.execute(
                """
                CREATE TABLE search_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER NOT NULL,
                    result_type TEXT NOT NULL,
                    result_path TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    title TEXT,
                    url TEXT,
                    description TEXT,
                    age TEXT,
                    raw_result TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES search_runs(id)
                )
                """
            )

        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_search_results_run_id "
            "ON search_results(run_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_search_runs_query "
            "ON search_runs(query)"
        )
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {FAVICON_TABLE} (
                domain TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                data BLOB NOT NULL,
                source_url TEXT,
                fetched_at TEXT NOT NULL,
                is_fallback INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        connection.execute(
            f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS {FTS_TABLE} USING fts5(
                result_id UNINDEXED,
                source_query,
                title,
                url,
                description,
                raw_result,
                tokenize='unicode61'
            )
            """
        )
        initialize_crawler_database(connection)
        result_count = connection.execute(
            "SELECT COUNT(*) FROM search_results"
        ).fetchone()[0]
        fts_count = connection.execute(
            f"SELECT COUNT(*) FROM {FTS_TABLE}"
        ).fetchone()[0]
        if fts_count != result_count:
            global INDEX_REBUILD_NEEDED
            INDEX_REBUILD_NEEDED = True


def rebuild_search_index() -> None:
    """Rebuild a stale search index after startup, never during startup."""
    global INDEX_REBUILD_NEEDED
    try:
        with closing(database_connection()) as connection, connection:
            connection.execute(f"DELETE FROM {FTS_TABLE}")
            connection.execute(
                f"""
                INSERT INTO {FTS_TABLE} (
                    result_id,
                    source_query,
                    title,
                    url,
                    description,
                    raw_result
                )
                SELECT
                    search_results.id,
                    COALESCE(search_runs.query, ''),
                    COALESCE(search_results.title, ''),
                    COALESCE(search_results.url, ''),
                    COALESCE(search_results.description, ''),
                    COALESCE(search_results.raw_result, '')
                FROM search_results
                LEFT JOIN search_runs ON search_runs.id = search_results.run_id
                """
            )
        INDEX_REBUILD_NEEDED = False
    except sqlite3.Error:
        # Keep the flag set so the next service start retries the rebuild.
        return


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    if INDEX_REBUILD_NEEDED:
        threading.Thread(target=rebuild_search_index, name="tron-search-index-rebuild", daemon=True).start()


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="operational",
        service="tron-api",
        timestamp=datetime.now(timezone.utc),
    )


@app.get("/api/favicon")
def favicon(
    background_tasks: BackgroundTasks,
    domain: str = Query(min_length=1, max_length=253),
) -> Response:
    try:
        normalized_domain = normalize_favicon_domain(domain)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid favicon domain") from exc

    content_type, data, needs_refresh = favicon_for_request(normalized_domain)
    if needs_refresh:
        with FAVICON_REFRESHING_LOCK:
            if normalized_domain not in FAVICON_REFRESHING:
                FAVICON_REFRESHING.add(normalized_domain)
                background_tasks.add_task(refresh_favicon, normalized_domain)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    return MetricsResponse(
        metrics=[
            Metric(label="Active sessions", value="2,847", change="+12.4%", tone="mint"),
            Metric(label="Requests / min", value="1,284", change="+8.7%", tone="blue"),
            Metric(label="Avg. response", value="86 ms", change="−4.2%", tone="violet"),
        ],
        activity=[
            "Realtime worker connected",
            "Metrics snapshot refreshed",
            "API gateway is accepting traffic",
        ],
    )


def extract_result_items(payload: Any) -> list[StoredResultItem]:
    """Collect every list stored under a key named `results` in the payload."""

    items: list[StoredResultItem] = []

    def walk(value: Any, path: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}"
                if key == "results" and isinstance(child, list):
                    result_type = path.rsplit(".", maxsplit=1)[-1]
                    for position, item in enumerate(child, start=1):
                        items.append(
                            StoredResultItem(
                                result_type=result_type,
                                result_path=child_path,
                                position=position,
                                value=item,
                            )
                        )
                walk(child, child_path)
        elif isinstance(value, list):
            for position, child in enumerate(value, start=1):
                walk(child, f"{path}[{position}]")

    walk(payload, "$")
    return items


def persist_search_response(
    *,
    request_id: str,
    query: str,
    requested_at: datetime,
    status_code: int,
    raw_response: bytes,
    payload: Any,
) -> None:
    """Atomically persist the exact response and every extracted result item."""

    result_items = extract_result_items(payload)
    response_hash = hashlib.sha256(raw_response).hexdigest()
    expected_count = len(result_items)
    last_error: Exception | None = None

    for attempt in range(1, 4):
        try:
            with closing(database_connection()) as connection, connection:
                connection.execute("BEGIN IMMEDIATE")
                cursor = connection.execute(
                    """
                    INSERT INTO search_runs (
                        request_id,
                        query,
                        requested_at,
                        brave_status_code,
                        response_sha256,
                        raw_response_bytes,
                        brave_result_count,
                        stored_result_count,
                        raw_response
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        request_id,
                        query,
                        requested_at.isoformat(),
                        status_code,
                        response_hash,
                        len(raw_response),
                        expected_count,
                        0,
                        sqlite3.Binary(raw_response),
                    ),
                )
                run_id = cursor.lastrowid
                connection.executemany(
                    """
                    INSERT INTO search_results (
                        run_id,
                        result_type,
                        result_path,
                        position,
                        title,
                        url,
                        description,
                        age,
                        raw_result
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            run_id,
                            item.result_type,
                            item.result_path,
                            item.position,
                            item.title,
                            item.url,
                            item.description,
                            item.age,
                            item.raw_result,
                        )
                        for item in result_items
                    ],
                )
                stored_count = connection.execute(
                    "SELECT COUNT(*) FROM search_results WHERE run_id = ?",
                    (run_id,),
                ).fetchone()[0]
                if stored_count != expected_count:
                    raise RuntimeError(
                        f"Stored {stored_count} results, expected {expected_count}"
                    )
                connection.execute(
                    f"""
                    INSERT INTO {FTS_TABLE} (
                        result_id,
                        source_query,
                        title,
                        url,
                        description,
                        raw_result
                    )
                    SELECT
                        search_results.id,
                        COALESCE(search_runs.query, ''),
                        COALESCE(search_results.title, ''),
                        COALESCE(search_results.url, ''),
                        COALESCE(search_results.description, ''),
                        COALESCE(search_results.raw_result, '')
                    FROM search_results
                    JOIN search_runs ON search_runs.id = search_results.run_id
                    WHERE search_results.run_id = ?
                    """,
                    (run_id,),
                )
                connection.execute(
                    "UPDATE search_runs SET stored_result_count = ? WHERE id = ?",
                    (stored_count, run_id),
                )
            return
        except (OSError, RuntimeError, sqlite3.Error) as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(0.1 * attempt)

    raise RuntimeError("Could not persist the complete Brave response") from last_error


SEARCH_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)

TIME_LOCATIONS: dict[str, tuple[str, str]] = {
    "perth": ("Perth WA", "Australia/Perth"),
    "peth": ("Perth WA", "Australia/Perth"),
    "sydney": ("Sydney NSW", "Australia/Sydney"),
    "melbourne": ("Melbourne VIC", "Australia/Melbourne"),
    "brisbane": ("Brisbane QLD", "Australia/Brisbane"),
    "adelaide": ("Adelaide SA", "Australia/Adelaide"),
    "darwin": ("Darwin NT", "Australia/Darwin"),
    "canberra": ("Canberra ACT", "Australia/Canberra"),
    "london": ("London", "Europe/London"),
    "new york": ("New York NY", "America/New_York"),
    "los angeles": ("Los Angeles CA", "America/Los_Angeles"),
    "tokyo": ("Tokyo", "Asia/Tokyo"),
    "singapore": ("Singapore", "Asia/Singapore"),
    "dubai": ("Dubai", "Asia/Dubai"),
    "paris": ("Paris", "Europe/Paris"),
    "utc": ("UTC", "UTC"),
}


def search_tokens(query: str) -> list[str]:
    return [token.lower() for token in SEARCH_TOKEN_RE.findall(query)]


def normalized_location(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9\s]", " ", value.lower()).split())


def build_time_tool_for_timezone(location: str, timezone_name: str) -> TimeToolResponse:
    current = datetime.now(ZoneInfo(timezone_name))
    return TimeToolResponse(
        tool="time",
        location=location,
        timezone=timezone_name,
        abbreviation=current.tzname() or timezone_name,
        time=current.strftime("%I:%M:%S %p").lstrip("0"),
        date=f"{current.strftime('%A')}, {current.day} {current.strftime('%B %Y')}",
        iso=current,
    )


def build_time_tool(location_key: str) -> TimeToolResponse:
    location, timezone_name = TIME_LOCATIONS[location_key]
    return build_time_tool_for_timezone(location, timezone_name)


def time_tool_for_query(query: str) -> TimeToolResponse | None:
    normalized = normalized_location(query)
    if not re.search(r"\b(?:time|clock)\b", normalized):
        return None
    for location_key in sorted(TIME_LOCATIONS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(location_key)}\b", normalized):
            return build_time_tool(location_key)
    return None


def fts_match_query(query: str, fields: tuple[str, ...] | None = None) -> str:
    tokens = search_tokens(query)
    # Require every meaningful query token. OR matching makes common words
    # such as "how" or "news" fan out across thousands of unrelated rows.
    if not fields:
        return " AND ".join(f'"{token.replace(chr(34), chr(34) * 2)}"*' for token in tokens)
    return " AND ".join(
        "("
        + " OR ".join(
            f'{field}:"{token.replace(chr(34), chr(34) * 2)}"*'
            for field in fields
        )
        + ")"
        for token in tokens
    )


def search_cache_key(query: str, page: int, limit: int) -> tuple[str, int, int]:
    return (" ".join(query.casefold().split()), page, limit)


def cached_search(key: tuple[str, int, int]) -> SearchResponse | None:
    now = time.monotonic()
    with SEARCH_CACHE_LOCK:
        entry = SEARCH_CACHE.get(key)
        if entry is None:
            return None
        created_at, response = entry
        if now - created_at > SEARCH_CACHE_TTL_SECONDS:
            SEARCH_CACHE.pop(key, None)
            return None
        SEARCH_CACHE.move_to_end(key)
        return deepcopy(response)


def cache_search(key: tuple[str, int, int], response: SearchResponse) -> None:
    with SEARCH_CACHE_LOCK:
        SEARCH_CACHE[key] = (time.monotonic(), deepcopy(response))
        SEARCH_CACHE.move_to_end(key)
        while len(SEARCH_CACHE) > SEARCH_CACHE_MAX_ENTRIES:
            SEARCH_CACHE.popitem(last=False)


def suggested_query(query: str) -> str | None:
    """Find a close, already-indexed query without making a network request."""
    query_tokens = search_tokens(query)
    if len(query_tokens) < 3:
        return None

    normalized_query = " ".join(query_tokens)
    try:
        connection = search_database_connection()
        candidates = [
            row[0]
            for row in connection.execute(
                "SELECT DISTINCT query FROM search_runs WHERE query IS NOT NULL"
            ).fetchall()
        ]
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail="Local search database failed") from exc

    best: tuple[float, str] | None = None
    for candidate in candidates:
        candidate_tokens = search_tokens(candidate)
        if len(candidate_tokens) < 3 or abs(len(candidate_tokens) - len(query_tokens)) > 3:
            continue

        full_score = SequenceMatcher(None, normalized_query, " ".join(candidate_tokens)).ratio()
        token_scores = [
            max(SequenceMatcher(None, token, candidate_token).ratio() for candidate_token in candidate_tokens)
            for token in query_tokens
        ]
        near_matches = sum(score >= 0.88 for score in token_scores)
        if near_matches < max(2, len(query_tokens) // 2):
            continue

        score = full_score * 0.55 + (sum(token_scores) / len(token_scores)) * 0.45
        if best is None or score > best[0]:
            best = (score, candidate)

    if best is None or best[0] < 0.75:
        return None
    return best[1]


def url_details(url: str) -> tuple[str, str, str] | None:
    parsed = urlsplit(url.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        return None

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return None

    display_domain = parsed.netloc
    display_url = f"{display_domain}{parsed.path.rstrip('/') or '/'}"
    if parsed.query:
        display_url += f"?{parsed.query}"
    normalized = urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/") or "/",
            parsed.query,
            "",
        )
    )
    return normalized, hostname.removeprefix("www."), display_url


def normalize_favicon_domain(value: str) -> str:
    domain = value.strip().lower().rstrip(".")
    if "://" in domain or "/" in domain or "@" in domain:
        raise ValueError("favicon domain must be a hostname")
    try:
        domain = domain.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("invalid favicon domain") from exc
    if len(domain) > 253 or not re.fullmatch(
        r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+",
        domain,
    ):
        raise ValueError("invalid favicon domain")
    try:
        ipaddress.ip_address(domain)
    except ValueError:
        return domain
    raise ValueError("IP address favicons are not allowed")


def validate_public_hostname(hostname: str) -> None:
    lowered = hostname.lower().rstrip(".")
    if lowered in {"localhost", "localhost.localdomain"} or lowered.endswith(".local"):
        raise ValueError("local favicon hosts are not allowed")
    try:
        addresses = {
            info[4][0]
            for info in socket.getaddrinfo(lowered, 443, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise ValueError("favicon host could not be resolved") from exc
    if not addresses:
        raise ValueError("favicon host could not be resolved")
    for address in addresses:
        parsed = ipaddress.ip_address(address)
        if not parsed.is_global:
            raise ValueError("private favicon hosts are not allowed")


def validate_remote_favicon_url(url: str) -> str:
    parsed = urlsplit(url)
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("favicon URL must use HTTP or HTTPS")
    normalize_favicon_domain(parsed.hostname)
    validate_public_hostname(parsed.hostname)
    return urlunsplit((parsed.scheme.lower(), parsed.netloc, parsed.path or "/", parsed.query, ""))


def fetch_limited(
    client: httpx.Client,
    url: str,
    *,
    accept: str,
    max_bytes: int,
) -> tuple[str, str, bytes] | None:
    current_url = url
    for _ in range(4):
        try:
            current_url = validate_remote_favicon_url(current_url)
            with client.stream("GET", current_url, headers={"Accept": accept}) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return None
                    current_url = urljoin(current_url, location)
                    continue
                if response.status_code < 200 or response.status_code >= 300:
                    return None
                content = bytearray()
                for chunk in response.iter_bytes(16 * 1024):
                    content.extend(chunk)
                    if len(content) > max_bytes:
                        return None
                return (
                    current_url,
                    response.headers.get("content-type", "").split(";", maxsplit=1)[0].lower(),
                    bytes(content),
                )
        except (httpx.HTTPError, OSError, ValueError):
            return None
    return None


def image_content_type(content_type: str, data: bytes, url: str) -> str | None:
    if content_type in FAVICON_MIME_TYPES:
        return content_type
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith((b"\x00\x00\x01\x00", b"\x00\x00\x02\x00")):
        return "image/x-icon"
    if data.startswith((b"\xff\xd8\xff", b"GIF8")):
        return "image/jpeg" if data.startswith(b"\xff\xd8\xff") else "image/gif"
    if content_type == "text/plain" and urlsplit(url).path.lower().endswith(".svg"):
        return "image/svg+xml"
    return None


def resolve_favicon(domain: str) -> tuple[str, bytes, str | None, bool]:
    fallback = ("image/svg+xml", FALLBACK_GLOBE_SVG, None, True)
    headers = {"User-Agent": "TRON favicon resolver/1.0", "Accept-Language": "en"}
    timeout = httpx.Timeout(5.0, connect=2.0)
    try:
        # Favicon assets are public, non-sensitive images. The host and every
        # resolved address are still validated before each request. Disabling
        # certificate verification here keeps icon resolution working on local
        # Windows installs that trust the browser's proxy certificate but do
        # not expose that certificate to Python's CA bundle.
        with httpx.Client(headers=headers, follow_redirects=False, timeout=timeout, verify=False) as client:
            homepage: tuple[str, str, bytes] | None = None
            for scheme in ("https", "http"):
                homepage = fetch_limited(
                    client,
                    f"{scheme}://{domain}/",
                    accept="text/html,application/xhtml+xml",
                    max_bytes=512 * 1024,
                )
                if homepage:
                    break

            bases = [homepage[0]] if homepage else []
            bases.extend(f"{scheme}://{domain}/" for scheme in ("https", "http"))
            candidates: list[str] = []
            if homepage:
                parser = FaviconLinkParser()
                parser.feed(homepage[2].decode("utf-8", errors="ignore"))
                for _, href in sorted(parser.links, key=lambda item: item[0]):
                    candidates.append(urljoin(bases[0], href))
            candidates.extend(urljoin(base, "/favicon.ico") for base in bases)

            seen: set[str] = set()
            for candidate in candidates:
                if candidate in seen:
                    continue
                seen.add(candidate)
                fetched = fetch_limited(
                    client,
                    candidate,
                    accept="image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    max_bytes=FAVICON_MAX_BYTES,
                )
                if not fetched:
                    continue
                final_url, content_type, data = fetched
                resolved_type = image_content_type(content_type, data, final_url)
                if resolved_type:
                    return resolved_type, data, final_url, False
    except (httpx.HTTPError, OSError, ValueError):
        pass
    return fallback


def cached_favicon(domain: str) -> tuple[str, bytes]:
    now = datetime.now(timezone.utc)
    with closing(database_connection()) as connection:
        row = connection.execute(
            f"SELECT content_type, data, fetched_at, is_fallback FROM {FAVICON_TABLE} WHERE domain = ?",
            (domain,),
        ).fetchone()
    if row:
        try:
            fetched_at = datetime.fromisoformat(row["fetched_at"])
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            ttl = FAVICON_FAILURE_CACHE_SECONDS if row["is_fallback"] else FAVICON_CACHE_SECONDS
            if (now - fetched_at).total_seconds() < ttl:
                return row["content_type"], bytes(row["data"])
        except (TypeError, ValueError):
            pass

    content_type, data, source_url, is_fallback = resolve_favicon(domain)
    with closing(database_connection()) as connection, connection:
        connection.execute(
            f"""
            INSERT INTO {FAVICON_TABLE} (domain, content_type, data, source_url, fetched_at, is_fallback)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(domain) DO UPDATE SET
                content_type = excluded.content_type,
                data = excluded.data,
                source_url = excluded.source_url,
                fetched_at = excluded.fetched_at,
                is_fallback = excluded.is_fallback
            """,
            (domain, content_type, sqlite3.Binary(data), source_url, now.isoformat(), int(is_fallback)),
        )
    return content_type, data


def favicon_for_request(domain: str) -> tuple[str, bytes, bool]:
    """Return immediately with cached data or the neutral fallback.

    A first-page render must not wait on arbitrary third-party websites. Stale
    cached icons are still useful and are refreshed in the background.
    """

    now = datetime.now(timezone.utc)
    with closing(database_connection()) as connection:
        row = connection.execute(
            f"SELECT content_type, data, fetched_at, is_fallback FROM {FAVICON_TABLE} WHERE domain = ?",
            (domain,),
        ).fetchone()
    if row:
        try:
            fetched_at = datetime.fromisoformat(row["fetched_at"])
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            ttl = FAVICON_FAILURE_CACHE_SECONDS if row["is_fallback"] else FAVICON_CACHE_SECONDS
            stale = (now - fetched_at).total_seconds() >= ttl
            return row["content_type"], bytes(row["data"]), stale
        except (TypeError, ValueError):
            pass
    return "image/svg+xml", FALLBACK_GLOBE_SVG, True


def refresh_favicon(domain: str) -> None:
    try:
        cached_favicon(domain)
    finally:
        with FAVICON_REFRESHING_LOCK:
            FAVICON_REFRESHING.discard(domain)


def result_score(row: sqlite3.Row, query: str, tokens: list[str]) -> float:
    title = (row["title"] or "").lower()
    description = (row["description"] or "").lower()
    details = url_details(row["url"] or "")
    hostname = details[1] if details else ""
    normalized_query = query.strip().lower()
    score = -float(row["fts_rank"] or 0)

    if normalized_query and normalized_query in title:
        score += 500
    if normalized_query and normalized_query in hostname:
        score += 700
    if tokens and all(token in hostname for token in tokens):
        score += 1000
    if tokens and all(token in title for token in tokens):
        score += 450
    score += sum(90 for token in tokens if token in title)
    score += sum(55 for token in tokens if token in hostname)
    score += sum(10 for token in tokens if token in description)

    # TRONXVI's Infinity property is preferred for brand-specific searches,
    # while unrelated searches retain normal relevance ordering.
    infinity_query = {"infinity", "tronxvi"}.intersection(tokens)
    if infinity_query and hostname == "infinity.tronxvi.com":
        score += 5000

    try:
        score += datetime.fromisoformat(row["requested_at"]).timestamp() / 1_000_000_000
    except (TypeError, ValueError, OverflowError):
        pass
    return score


def clean_display_text(value: str | None) -> str | None:
    if not value:
        return None
    decoded = value
    for _ in range(3):
        decoded = unescape(decoded)
    without_markup = re.sub(r"<[^>]*>", " ", decoded)
    return " ".join(without_markup.split())


def local_search(query: str, page: int, limit: int, allow_correction: bool = True) -> SearchResponse:
    tool_answer = time_tool_for_query(query)
    search_match_query = fts_match_query(query, SEARCH_FTS_FIELDS)
    crawl_match_query = fts_match_query(query, CRAWL_FTS_FIELDS)
    if not search_match_query:
        return SearchResponse(
            query=query,
            page=page,
            limit=limit,
            result_count=0,
            has_previous=page > 1,
            has_next=False,
            results=[],
            tool=tool_answer,
        )

    tokens = search_tokens(query)
    candidate_limit = min(2000, max(SEARCH_CANDIDATE_LIMIT, page * limit + limit))
    try:
        connection = search_database_connection()
        search_result_count = connection.execute(
            f"SELECT COUNT(*) FROM {FTS_TABLE} WHERE {FTS_TABLE} MATCH ?",
            (search_match_query,),
        ).fetchone()[0]
        crawl_result_count = connection.execute(
            f"SELECT COUNT(*) FROM {CRAWL_PAGES_FTS_TABLE} WHERE {CRAWL_PAGES_FTS_TABLE} MATCH ?",
            (crawl_match_query,),
        ).fetchone()[0]
        with connection:
            rows = connection.execute(
                f"""
                SELECT
                    search_results.id,
                    search_results.title,
                    search_results.url,
                    search_results.description,
                    search_results.age,
                    search_runs.query AS source_query,
                    search_runs.requested_at,
                    bm25({FTS_TABLE}, 10.0, 5.0, 3.0, 1.0, 0.25) AS fts_rank
                FROM {FTS_TABLE}
                JOIN search_results
                    ON search_results.id = CAST({FTS_TABLE}.result_id AS INTEGER)
                JOIN search_runs ON search_runs.id = search_results.run_id
                WHERE {FTS_TABLE} MATCH ?
                ORDER BY bm25({FTS_TABLE}, 10.0, 5.0, 3.0, 1.0, 0.25) ASC
                LIMIT ?
                """,
                (search_match_query, candidate_limit),
            ).fetchall()
            crawl_rows = connection.execute(
                f"""
                SELECT
                    crawl_pages.id,
                    crawl_pages.title,
                    crawl_pages.url,
                    crawl_pages.description,
                    NULL AS age,
                    'TRON crawler' AS source_query,
                    crawl_pages.fetched_at AS requested_at,
                    bm25({CRAWL_PAGES_FTS_TABLE}, 10.0, 5.0, 3.0, 2.0, 0.25) AS fts_rank
                FROM {CRAWL_PAGES_FTS_TABLE}
                JOIN crawl_pages
                    ON crawl_pages.id = CAST({CRAWL_PAGES_FTS_TABLE}.page_id AS INTEGER)
                WHERE {CRAWL_PAGES_FTS_TABLE} MATCH ?
                ORDER BY bm25({CRAWL_PAGES_FTS_TABLE}, 10.0, 5.0, 3.0, 2.0, 0.25) ASC
                LIMIT ?
                """,
                (crawl_match_query, candidate_limit),
            ).fetchall()
            rows = [*rows, *crawl_rows]
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail="Local search database failed") from exc

    best_by_url: dict[str, tuple[float, sqlite3.Row, tuple[str, str, str]]] = {}
    for row in rows:
        details = url_details(row["url"] or "")
        if not details:
            continue
        score = result_score(row, query, tokens)
        existing = best_by_url.get(details[0])
        if existing is None or score > existing[0]:
            best_by_url[details[0]] = (score, row, details)

    ranked = sorted(
        best_by_url.values(),
        key=lambda item: (item[0], item[1]["requested_at"]),
        reverse=True,
    )
    start = (page - 1) * limit
    page_items = ranked[start : start + limit]
    results = [
        SearchResult(
            rank=start + index,
            title=clean_display_text(row["title"]) or "Untitled result",
            url=row["url"],
            description=clean_display_text(row["description"]),
            age=row["age"],
            domain=details[1],
            display_url=details[2],
            source_query=row["source_query"],
            collected_at=datetime.fromisoformat(row["requested_at"]),
        )
        for index, (_, row, details) in enumerate(page_items, start=1)
    ]

    if not ranked and allow_correction and not tool_answer:
        correction = suggested_query(query)
        if correction and correction.casefold() != query.casefold():
            corrected_response = local_search(correction, page, limit, allow_correction=False)
            if corrected_response.result_count > 0:
                corrected_response.query = query
                corrected_response.corrected_query = correction
                return corrected_response

    return SearchResponse(
        query=query,
        page=page,
        limit=limit,
        result_count=search_result_count + crawl_result_count,
        has_previous=page > 1,
        has_next=start + limit < search_result_count + crawl_result_count,
        results=results,
        tool=tool_answer,
    )


@app.get("/api/search", response_model=SearchResponse)
def search(
    q: str = Query(min_length=1, max_length=300),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=20),
) -> SearchResponse:
    tool_query = time_tool_for_query(q) is not None
    key = search_cache_key(q, page, limit)
    if not tool_query:
        cached = cached_search(key)
        if cached is not None:
            return cached

    response = local_search(q, page, limit)
    if not tool_query:
        cache_search(key, response)
    return response


@app.post("/api/chat/stream")
def chat_stream(payload: ChatRequest):
    """Proxy the Infinity General Chat SSE contract for the desktop renderer."""
    return stream_chat(payload)


@app.get("/api/crawler/status")
def crawler_status_route() -> dict[str, object]:
    with closing(database_connection()) as connection:
        return crawler_status(connection)


@app.post("/api/crawler/seeds")
def crawler_seeds(payload: CrawlerSeedsRequest) -> dict[str, object]:
    if not payload.urls:
        raise HTTPException(status_code=400, detail="Provide at least one HTTP or HTTPS seed URL")
    if len(payload.urls) > 100:
        raise HTTPException(status_code=400, detail="A maximum of 100 seed URLs may be added per request")
    if payload.depth < 0 or payload.depth > 10:
        raise HTTPException(status_code=400, detail="Depth must be between 0 and 10")
    with closing(database_connection()) as connection:
        result = enqueue_urls(connection, payload.urls, payload.depth)
        return {**result, "enabled": CRAWLER_ENABLED or crawler_runtime.enabled, "running": crawler_runtime.running}


@app.post("/api/crawler/start")
def start_crawler(payload: CrawlerStartRequest | None = None) -> dict[str, object]:
    if not CRAWLER_ENABLED:
        raise HTTPException(status_code=503, detail="Crawler is disabled. Set TRON_CRAWLER_ENABLED=true to start it.")
    with closing(database_connection()) as connection:
        queued = connection.execute(
            "SELECT COUNT(*) FROM crawl_queue WHERE state='queued'"
        ).fetchone()[0]
    if not queued:
        raise HTTPException(status_code=400, detail="Crawler queue is empty. Add seed URLs first.")
    if payload is not None and payload.discover_links:
        raise HTTPException(status_code=409, detail="Automatic crawler queue growth is disabled.")
    discover_links = False
    crawler_runtime.start(str(DATABASE_PATH), discover_links=discover_links)
    return {
        "enabled": CRAWLER_ENABLED,
        "running": True,
        "queued": queued,
        "run_id": crawler_runtime.run_id,
        "discover_links": discover_links,
    }


@app.post("/api/crawler/stop")
def stop_crawler() -> dict[str, object]:
    crawler_runtime.stop()
    return {"enabled": False, "running": False}


@app.get("/api/tools/time", response_model=TimeToolResponse)
def time_tool(
    location: str = Query(default="perth", min_length=1, max_length=80),
    timezone: str | None = Query(default=None, max_length=80),
) -> TimeToolResponse:
    if timezone:
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Unknown IANA timezone") from exc
        return build_time_tool_for_timezone(location.strip() or timezone, timezone)

    location_key = normalized_location(location)
    if location_key not in TIME_LOCATIONS:
        raise HTTPException(status_code=404, detail="Unsupported time location")
    return build_time_tool(location_key)

