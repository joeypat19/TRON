"""Inactive, policy-aware crawler for the TRON local search index.

The crawler is deliberately opt-in.  It has no built-in seed URLs and will not
start unless TRON_CRAWLER_ENABLED=true is explicitly configured and the start
endpoint is called.  The same SQLite database is used for the crawl queue,
page archive, links, robots cache, and full-text search index.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import re
import socket
import sqlite3
import threading
import time
import uuid
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from urllib import robotparser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx

try:
    import truststore
except ImportError:  # pragma: no cover - requirements install truststore
    truststore = None


if truststore is not None:
    # On Windows, the native trust store may contain enterprise/proxy roots
    # that are not present in certifi's static CA bundle.  Keep certificate
    # verification enabled while using the platform's trusted roots.
    truststore.inject_into_ssl()


CRAWL_PAGES_FTS_TABLE = "crawl_pages_fts"
CRAWL_RUNS_TABLE = "crawl_runs"
CRAWL_EVENTS_TABLE = "crawl_events"
CRAWLER_USER_AGENT = os.getenv(
    "TRON_CRAWLER_USER_AGENT",
    "TRONBot/0.1 (+https://tronxvi.com/crawler)",
)
CRAWLER_ENABLED = os.getenv("TRON_CRAWLER_ENABLED", "false").strip().lower() == "true"
MAX_PAGE_BYTES = int(os.getenv("TRON_CRAWLER_MAX_PAGE_BYTES", str(5 * 1024 * 1024)))
MAX_DEPTH = int(os.getenv("TRON_CRAWLER_MAX_DEPTH", "3"))
REQUEST_DELAY_SECONDS = float(os.getenv("TRON_CRAWLER_DELAY_SECONDS", "1.0"))
REQUEST_TIMEOUT_SECONDS = float(os.getenv("TRON_CRAWLER_TIMEOUT_SECONDS", "20"))
CRAWLER_WORKERS = max(1, min(64, int(os.getenv("TRON_CRAWLER_WORKERS", "10"))))
PER_DOMAIN_CONCURRENCY = max(1, min(CRAWLER_WORKERS, int(os.getenv("TRON_CRAWLER_PER_DOMAIN_CONCURRENCY", "2"))))
DNS_CACHE_TTL_SECONDS = max(1, int(os.getenv("TRON_CRAWLER_DNS_CACHE_TTL_SECONDS", "300")))
SITEMAP_CACHE_TTL_SECONDS = max(60, int(os.getenv("TRON_CRAWLER_SITEMAP_CACHE_TTL_SECONDS", str(24 * 60 * 60))))
MAX_LINKS_PER_PAGE = max(1, int(os.getenv("TRON_CRAWLER_MAX_LINKS_PER_PAGE", "2000")))
MAX_QUEUE_SIZE = max(100, int(os.getenv("TRON_CRAWLER_MAX_QUEUE_SIZE", "250000")))
MAX_PAGES_PER_DOMAIN = max(0, int(os.getenv("TRON_CRAWLER_MAX_PAGES_PER_DOMAIN", "100000")))
MAX_REDIRECTS = max(0, int(os.getenv("TRON_CRAWLER_MAX_REDIRECTS", "5")))
LEASE_SECONDS = max(60, int(os.getenv("TRON_CRAWLER_LEASE_SECONDS", "300")))
MAX_ATTEMPTS = 3

TRACKING_QUERY_KEYS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "source",
}
TRACKING_QUERY_PREFIXES = ("utm_",)
PUBLIC_HOST_CACHE: dict[str, tuple[float, bool]] = {}
PUBLIC_HOST_CACHE_LOCK = threading.Lock()
SITEMAP_CACHE: dict[str, tuple[float, list[str]]] = {}
SITEMAP_CACHE_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonicalize_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only HTTP and HTTPS URLs can be crawled")
    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not allowed")

    hostname = parsed.hostname.lower().rstrip(".")
    port = parsed.port
    if port and not ((parsed.scheme.lower() == "http" and port == 80) or (parsed.scheme.lower() == "https" and port == 443)):
        netloc = f"{hostname}:{port}"
    else:
        netloc = hostname
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = f"/{path}"
    query_parts = [
        (key, query_value)
        for key, query_value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_KEYS
        and not key.lower().startswith(TRACKING_QUERY_PREFIXES)
    ]
    query = urlencode(sorted(query_parts), doseq=True)
    return urlunsplit((parsed.scheme.lower(), netloc, path, query, ""))


def is_public_hostname(hostname: str, *, force_refresh: bool = False) -> bool:
    """Reject localhost/private targets to prevent SSRF through the crawler."""

    normalized_hostname = hostname.strip().lower().rstrip(".")
    if not normalized_hostname:
        return False

    now = time.monotonic()
    if not force_refresh:
        with PUBLIC_HOST_CACHE_LOCK:
            cached = PUBLIC_HOST_CACHE.get(normalized_hostname)
            if cached and cached[0] > now:
                return cached[1]

    try:
        addresses = {
            info[4][0]
            for info in socket.getaddrinfo(normalized_hostname, None, type=socket.SOCK_STREAM)
        }
    except socket.gaierror:
        with PUBLIC_HOST_CACHE_LOCK:
            PUBLIC_HOST_CACHE[normalized_hostname] = (now + min(60, DNS_CACHE_TTL_SECONDS), False)
        return False

    result = bool(addresses) and all(ipaddress.ip_address(address).is_global for address in addresses)
    with PUBLIC_HOST_CACHE_LOCK:
        PUBLIC_HOST_CACHE[normalized_hostname] = (now + DNS_CACHE_TTL_SECONDS, result)
    return result


class HostRequestLimiter:
    """Enforce a minimum delay between requests to the same host."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_allowed: dict[str, float] = {}

    def wait(self, hostname: str, extra_delay: float | None = None) -> None:
        delay = max(0.0, REQUEST_DELAY_SECONDS, extra_delay or 0.0)
        now = time.monotonic()
        with self._lock:
            scheduled = max(now, self._next_allowed.get(hostname, now))
            self._next_allowed[hostname] = scheduled + delay
        sleep_for = scheduled - now
        if sleep_for > 0:
            time.sleep(sleep_for)


class HostConcurrencyLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._semaphores: dict[str, threading.BoundedSemaphore] = {}

    def slot(self, hostname: str) -> threading.BoundedSemaphore:
        with self._lock:
            return self._semaphores.setdefault(
                hostname,
                threading.BoundedSemaphore(PER_DOMAIN_CONCURRENCY),
            )


def normalized_text(value: str) -> str:
    return " ".join(unescape(value).split())


class PageParser(HTMLParser):
    """Extract search-oriented content without executing page JavaScript."""

    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title_parts: list[str] = []
        self.description = ""
        self.canonical_url: str | None = None
        self.language: str | None = None
        self.headings: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._active_title = False
        self._active_heading = False
        self._skip_depth = 0
        self._current_link: str | None = None
        self._current_anchor: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.lower()
        attributes = {key.lower(): value for key, value in attrs}
        if name == "html":
            self.language = attributes.get("lang") or self.language
        if name == "meta":
            key = (attributes.get("name") or attributes.get("property") or "").lower()
            if key in {"description", "og:description", "twitter:description"} and attributes.get("content"):
                self.description = normalized_text(attributes["content"] or "")
        if name == "link" and "canonical" in {part.lower() for part in (attributes.get("rel") or "").split()}:
            href = attributes.get("href")
            if href:
                self.canonical_url = urljoin(self.base_url, href)
        if name in {"script", "style", "noscript", "template", "svg"}:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if name == "title":
            self._active_title = True
        if name in {"h1", "h2", "h3"}:
            self._active_heading = True
        if name == "a" and attributes.get("href"):
            try:
                self._current_link = canonicalize_url(urljoin(self.base_url, attributes["href"] or ""))
                self._current_anchor = []
            except ValueError:
                self._current_link = None

    def handle_endtag(self, tag: str) -> None:
        name = tag.lower()
        if name in {"script", "style", "noscript", "template", "svg"} and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if name == "title":
            self._active_title = False
        if name in {"h1", "h2", "h3"}:
            self._active_heading = False
        if name == "a" and self._current_link:
            if len(self.links) < MAX_LINKS_PER_PAGE:
                self.links.append((self._current_link, normalized_text(" ".join(self._current_anchor))))
            self._current_link = None
            self._current_anchor = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = normalized_text(data)
        if not text:
            return
        self.text_parts.append(text)
        if self._active_title:
            self.title_parts.append(text)
        if self._active_heading:
            self.headings.append(text)
        if self._current_link:
            self._current_anchor.append(text)


@dataclass(frozen=True)
class ParsedPage:
    url: str
    canonical_url: str
    title: str
    description: str
    headings: str
    content: str
    language: str | None
    links: list[tuple[str, str]]


def initialize_crawler_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        f"""
        CREATE TABLE IF NOT EXISTS crawl_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            discovered_from TEXT,
            depth INTEGER NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 0,
            state TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TEXT,
            last_error TEXT,
            lease_owner TEXT,
            lease_expires_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_crawl_queue_ready
            ON crawl_queue(state, next_attempt_at, priority, id);
        CREATE TABLE IF NOT EXISTS crawl_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            canonical_url TEXT NOT NULL,
            domain TEXT NOT NULL,
            title TEXT,
            description TEXT,
            headings TEXT,
            content TEXT NOT NULL,
            language TEXT,
            content_hash TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            content_type TEXT,
            response_bytes INTEGER NOT NULL DEFAULT 0,
            etag TEXT,
            last_modified TEXT,
            fetched_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_crawl_pages_domain ON crawl_pages(domain);
        CREATE INDEX IF NOT EXISTS idx_crawl_pages_canonical_url ON crawl_pages(canonical_url);
        CREATE TABLE IF NOT EXISTS crawl_content_blobs (
            content_hash TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS crawl_links (
            source_page_id INTEGER NOT NULL,
            target_url TEXT NOT NULL,
            anchor_text TEXT,
            PRIMARY KEY(source_page_id, target_url),
            FOREIGN KEY(source_page_id) REFERENCES crawl_pages(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS crawl_robots (
            domain TEXT PRIMARY KEY,
            robots_url TEXT NOT NULL,
            body TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            fetched_at TEXT NOT NULL,
            sitemaps TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS {CRAWL_RUNS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            status TEXT NOT NULL,
            pages_discovered INTEGER NOT NULL DEFAULT 0,
            pages_attempted INTEGER NOT NULL DEFAULT 0,
            pages_fetched INTEGER NOT NULL DEFAULT 0,
            pages_stored INTEGER NOT NULL DEFAULT 0,
            pages_blocked INTEGER NOT NULL DEFAULT 0,
            pages_failed INTEGER NOT NULL DEFAULT 0,
            bytes_downloaded INTEGER NOT NULL DEFAULT 0,
            last_activity_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS {CRAWL_EVENTS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            url TEXT,
            status_code INTEGER,
            bytes_downloaded INTEGER NOT NULL DEFAULT 0,
            detail TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(run_id) REFERENCES {CRAWL_RUNS_TABLE}(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_crawl_events_run_id
            ON {CRAWL_EVENTS_TABLE}(run_id, id DESC);
        CREATE VIRTUAL TABLE IF NOT EXISTS {CRAWL_PAGES_FTS_TABLE} USING fts5(
            page_id UNINDEXED,
            title,
            url,
            description,
            headings,
            content,
            tokenize='unicode61'
        );
        """
    )
    queue_columns = {row[1] for row in connection.execute("PRAGMA table_info(crawl_queue)")}
    for name, definition in (
        ("lease_owner", "TEXT"),
        ("lease_expires_at", "TEXT"),
    ):
        if name not in queue_columns:
            connection.execute(f"ALTER TABLE crawl_queue ADD COLUMN {name} {definition}")
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_crawl_queue_lease ON crawl_queue(state, lease_expires_at)"
    )
    deduplicate_existing_pages(connection)
    connection.execute(
        """
        INSERT OR IGNORE INTO crawl_content_blobs (content_hash, content, created_at, updated_at)
        SELECT content_hash, content, MIN(fetched_at), MAX(updated_at)
        FROM crawl_pages
        WHERE content_hash IS NOT NULL
        GROUP BY content_hash
        """
    )
    connection.execute(
        "DELETE FROM crawl_content_blobs WHERE content_hash NOT IN (SELECT DISTINCT content_hash FROM crawl_pages)"
    )
    # Keep the legacy column for schema compatibility; the shared blob table is
    # the source of truth for newly crawled bodies and FTS indexing.
    connection.execute("UPDATE crawl_pages SET content='' WHERE content <> ''")
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_pages_canonical_url_unique ON crawl_pages(canonical_url)"
    )
    connection.commit()


def deduplicate_existing_pages(connection: sqlite3.Connection) -> int:
    """Keep the newest row for each canonical URL and remove older duplicates."""
    duplicate_ids = [
        row[0]
        for row in connection.execute(
            """
            SELECT id
            FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY canonical_url
                    ORDER BY fetched_at DESC, id DESC
                ) AS row_number
                FROM crawl_pages
            )
            WHERE row_number > 1
            """
        ).fetchall()
    ]
    for offset in range(0, len(duplicate_ids), 500):
        batch = duplicate_ids[offset : offset + 500]
        placeholders = ",".join("?" for _ in batch)
        connection.execute(
            f"DELETE FROM {CRAWL_PAGES_FTS_TABLE} WHERE page_id IN ({placeholders})",
            batch,
        )
        connection.execute(
            f"DELETE FROM crawl_links WHERE source_page_id IN ({placeholders})",
            batch,
        )
        connection.execute(
            f"DELETE FROM crawl_pages WHERE id IN ({placeholders})",
            batch,
        )
    return len(duplicate_ids)


def crawler_status(connection: sqlite3.Connection) -> dict[str, object]:
    counts = {
        row["state"]: row["count"]
        for row in connection.execute(
            "SELECT state, COUNT(*) AS count FROM crawl_queue GROUP BY state"
        ).fetchall()
    }
    page_count = connection.execute("SELECT COUNT(*) FROM crawl_pages").fetchone()[0]
    domain_count = connection.execute("SELECT COUNT(DISTINCT domain) FROM crawl_pages").fetchone()[0]
    run = connection.execute(
        f"SELECT * FROM {CRAWL_RUNS_TABLE} ORDER BY id DESC LIMIT 1"
    ).fetchone()
    events = []
    if run:
        events = [
            dict(row)
            for row in connection.execute(
                f"SELECT event_type, url, status_code, bytes_downloaded, detail, created_at FROM {CRAWL_EVENTS_TABLE} WHERE run_id=? ORDER BY id DESC LIMIT 20",
                (run["id"],),
            ).fetchall()
        ]
    return {
        "enabled": CRAWLER_ENABLED or runtime.enabled,
        "running": runtime.running,
        "queue": counts,
        "queued": counts.get("queued", 0),
        "pages": page_count,
        "domains": domain_count,
        "seeds_loaded": sum(counts.values()) > 0,
        "run": dict(run) if run else None,
        "recent_events": events,
    }


def enqueue_urls(
    connection: sqlite3.Connection,
    urls: list[str],
    depth: int = 0,
    *,
    commit: bool = True,
) -> dict[str, int]:
    added = 0
    rejected = 0
    now = utc_now()
    queued_count = connection.execute(
        "SELECT COUNT(*) FROM crawl_queue WHERE state IN ('queued', 'in_progress')"
    ).fetchone()[0]
    remaining_capacity = max(0, MAX_QUEUE_SIZE - queued_count)
    for raw_url in urls:
        if added >= remaining_capacity:
            rejected += 1
            continue
        try:
            url = canonicalize_url(raw_url)
        except ValueError:
            rejected += 1
            continue
        if not is_public_hostname(urlsplit(url).hostname or ""):
            rejected += 1
            continue
        try:
            connection.execute(
                "INSERT OR IGNORE INTO crawl_queue (url, depth, state, created_at, updated_at) VALUES (?, ?, 'queued', ?, ?)",
                (url, max(0, min(depth, MAX_DEPTH)), now, now),
            )
            added += connection.execute("SELECT changes()").fetchone()[0]
        except sqlite3.Error:
            rejected += 1
    if commit:
        connection.commit()
    return {"added": added, "rejected": rejected}


def parser_crawl_delay(parser: robotparser.RobotFileParser) -> float | None:
    for agent in (CRAWLER_USER_AGENT, "*"):
        try:
            value = parser.crawl_delay(agent)
        except (AttributeError, TypeError):
            value = None
        if value is not None:
            return float(value)
    return None


def fetch_limited(
    client: httpx.Client,
    url: str,
    *,
    headers: dict[str, str],
    max_bytes: int,
    request_limiter: HostRequestLimiter,
    crawl_delay: float | None = None,
) -> httpx.Response:
    """Fetch a bounded response while validating every redirect target."""
    current_url = url
    for _ in range(MAX_REDIRECTS + 1):
        parsed = urlsplit(current_url)
        hostname = parsed.hostname or ""
        if parsed.scheme.lower() not in {"http", "https"} or not is_public_hostname(hostname, force_refresh=True):
            raise RuntimeError("Target is not a public HTTP address")

        request_limiter.wait(hostname, crawl_delay)
        request_headers = dict(headers)
        request_headers.setdefault("Accept-Encoding", "identity")
        with client.stream(
            "GET",
            current_url,
            headers=request_headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,
        ) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise RuntimeError("Redirect did not include a location")
                try:
                    current_url = canonicalize_url(urljoin(current_url, location))
                except ValueError as exc:
                    raise RuntimeError("Redirect target is invalid") from exc
                continue

            content = bytearray()
            for chunk in response.iter_bytes(64 * 1024):
                content.extend(chunk)
                if len(content) > max_bytes:
                    raise RuntimeError("Response exceeds the configured size limit")

            return httpx.Response(
                response.status_code,
                headers=response.headers,
                content=bytes(content),
                request=response.request,
            )

    raise RuntimeError("Too many redirects")


def robots_for(
    connection: sqlite3.Connection,
    url: str,
    client: httpx.Client,
    request_limiter: HostRequestLimiter,
) -> tuple[robotparser.RobotFileParser, list[str]]:
    parsed = urlsplit(url)
    domain = parsed.netloc.lower()
    row = connection.execute("SELECT * FROM crawl_robots WHERE domain = ?", (domain,)).fetchone()
    if row:
        fetched = datetime.fromisoformat(row["fetched_at"])
        if (datetime.now(timezone.utc) - fetched).total_seconds() < 24 * 60 * 60:
            parser = robotparser.RobotFileParser()
            parser.set_url(row["robots_url"])
            parser.parse(row["body"].splitlines())
            return parser, list(json.loads(row["sitemaps"] or "[]"))

    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    body = ""
    status_code = 0
    try:
        response = fetch_limited(
            client,
            robots_url,
            headers={"User-Agent": CRAWLER_USER_AGENT},
            max_bytes=512 * 1024,
            request_limiter=request_limiter,
        )
        status_code = response.status_code
        if response.status_code < 400:
            body = response.text
    except (httpx.HTTPError, RuntimeError, UnicodeError):
        body = ""
    parser = robotparser.RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(body.splitlines())
    sitemaps = [line.split(":", 1)[1].strip() for line in body.splitlines() if line.lower().startswith("sitemap:")]
    connection.execute(
        "INSERT OR REPLACE INTO crawl_robots (domain, robots_url, body, status_code, fetched_at, sitemaps) VALUES (?, ?, ?, ?, ?, ?)",
        (domain, robots_url, body, status_code, utc_now(), json.dumps(sitemaps)),
    )
    connection.commit()
    return parser, sitemaps


def parse_page(url: str, body: bytes) -> ParsedPage:
    text = body.decode("utf-8", errors="replace")
    parser = PageParser(url)
    parser.feed(text)
    canonical = parser.canonical_url or url
    try:
        canonical = canonicalize_url(canonical)
    except ValueError:
        canonical = url
    content = normalized_text(" ".join(parser.text_parts))
    return ParsedPage(
        url=url,
        canonical_url=canonical,
        title=normalized_text(" ".join(parser.title_parts))[:500],
        description=parser.description[:1000],
        headings=normalized_text(" ".join(parser.headings))[:4000],
        content=content[:1_000_000],
        language=parser.language,
        links=parser.links,
    )


def sitemap_page_urls(
    client: httpx.Client,
    sitemap_urls: list[str],
    domain: str,
    request_limiter: HostRequestLimiter,
    crawl_delay: float | None,
) -> list[str]:
    now = time.monotonic()
    with SITEMAP_CACHE_LOCK:
        cached = SITEMAP_CACHE.get(domain)
        if cached and cached[0] > now:
            return list(cached[1])

    discovered: list[str] = []
    for sitemap_url in sitemap_urls[:10]:
        try:
            response = fetch_limited(
                client,
                sitemap_url,
                headers={"User-Agent": CRAWLER_USER_AGENT, "Accept": "application/xml,text/xml"},
                max_bytes=MAX_PAGE_BYTES,
                request_limiter=request_limiter,
                crawl_delay=crawl_delay,
            )
            if response.status_code >= 400:
                continue
            text = response.text
            for raw_url in re.findall(r"<loc[^>]*>(.*?)</loc>", text, flags=re.IGNORECASE | re.DOTALL):
                try:
                    candidate = canonicalize_url(unescape(raw_url.strip()))
                except ValueError:
                    continue
                if urlsplit(candidate).netloc.lower() == domain:
                    discovered.append(candidate)
        except (httpx.HTTPError, RuntimeError, UnicodeError):
            continue
    result = list(dict.fromkeys(discovered))
    with SITEMAP_CACHE_LOCK:
        SITEMAP_CACHE[domain] = (now + SITEMAP_CACHE_TTL_SECONDS, result)
    return result


def save_page(
    connection: sqlite3.Connection,
    page: ParsedPage,
    response: httpx.Response,
    *,
    queue_id: int,
) -> bool:
    now = utc_now()
    content_hash = hashlib.sha256(page.content.encode("utf-8")).hexdigest()
    domain = urlsplit(page.url).netloc.lower()
    duplicate = connection.execute(
        "SELECT id FROM crawl_pages WHERE canonical_url = ? AND url <> ? LIMIT 1",
        (page.canonical_url, page.url),
    ).fetchone()
    if duplicate:
        connection.execute(
            "UPDATE crawl_queue SET state='complete', last_error=NULL, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?",
            (now, queue_id),
        )
        return False

    connection.execute(
        """
        INSERT INTO crawl_content_blobs (content_hash, content, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(content_hash) DO UPDATE SET updated_at=excluded.updated_at
        """,
        (content_hash, page.content, now, now),
    )
    connection.execute(
        """
        INSERT INTO crawl_pages (url, canonical_url, domain, title, description, headings, content, language, content_hash, status_code, content_type, response_bytes, etag, last_modified, fetched_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
            canonical_url=excluded.canonical_url, domain=excluded.domain, title=excluded.title,
            description=excluded.description, headings=excluded.headings, content=excluded.content,
            language=excluded.language, content_hash=excluded.content_hash, status_code=excluded.status_code,
            content_type=excluded.content_type, response_bytes=excluded.response_bytes, etag=excluded.etag,
            last_modified=excluded.last_modified, fetched_at=excluded.fetched_at, updated_at=excluded.updated_at
        """,
        (page.url, page.canonical_url, domain, page.title, page.description, page.headings, "", page.language, content_hash, response.status_code, response.headers.get("content-type"), len(response.content), response.headers.get("etag"), response.headers.get("last-modified"), now, now),
    )
    page_row = connection.execute("SELECT id FROM crawl_pages WHERE url = ?", (page.url,)).fetchone()
    page_id = page_row["id"]
    content_blob = connection.execute(
        "SELECT content FROM crawl_content_blobs WHERE content_hash = ?",
        (content_hash,),
    ).fetchone()["content"]
    connection.execute(f"DELETE FROM {CRAWL_PAGES_FTS_TABLE} WHERE page_id = ?", (page_id,))
    connection.execute(
        f"INSERT INTO {CRAWL_PAGES_FTS_TABLE} (page_id, title, url, description, headings, content) VALUES (?, ?, ?, ?, ?, ?)",
        (page_id, page.title, page.url, page.description, page.headings, content_blob),
    )
    connection.execute("DELETE FROM crawl_links WHERE source_page_id = ?", (page_id,))
    connection.executemany(
        "INSERT OR IGNORE INTO crawl_links (source_page_id, target_url, anchor_text) VALUES (?, ?, ?)",
        [(page_id, target, anchor[:500]) for target, anchor in page.links],
    )
    connection.execute(
        "UPDATE crawl_queue SET state='complete', last_error=NULL, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?",
        (now, queue_id),
    )
    return True


def crawl_one(
    connection: sqlite3.Connection,
    client: httpx.Client,
    row: sqlite3.Row,
    *,
    discover_links: bool = True,
    request_limiter: HostRequestLimiter,
) -> tuple[str, int, str]:
    url = row["url"]
    domain = urlsplit(url).netloc.lower()
    if not is_public_hostname(urlsplit(url).hostname or "", force_refresh=True):
        connection.execute("UPDATE crawl_queue SET state='blocked', last_error=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?", ("Target is not a public address", utc_now(), row["id"]))
        connection.commit()
        return "blocked", 0, "Target is not a public address"
    if MAX_PAGES_PER_DOMAIN and connection.execute(
        "SELECT COUNT(*) FROM crawl_pages WHERE domain = ?",
        (domain,),
    ).fetchone()[0] >= MAX_PAGES_PER_DOMAIN:
        detail = "Domain page limit reached"
        connection.execute(
            "UPDATE crawl_queue SET state='blocked', last_error=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?",
            (detail, utc_now(), row["id"]),
        )
        connection.commit()
        return "blocked", 0, detail

    parser, sitemaps = robots_for(connection, url, client, request_limiter)
    if not parser.can_fetch(CRAWLER_USER_AGENT, url):
        connection.execute("UPDATE crawl_queue SET state='blocked', last_error=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?", ("Disallowed by robots.txt", utc_now(), row["id"]))
        connection.commit()
        return "blocked", 0, "Disallowed by robots.txt"
    if discover_links:
        sitemap_urls = sitemap_page_urls(
            client,
            sitemaps,
            domain,
            request_limiter,
            parser_crawl_delay(parser),
        )
        if sitemap_urls:
            enqueue_urls(connection, sitemap_urls, int(row["depth"]), commit=False)
    try:
        response = fetch_limited(
            client,
            url,
            headers={"User-Agent": CRAWLER_USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            max_bytes=MAX_PAGE_BYTES,
            request_limiter=request_limiter,
            crawl_delay=parser_crawl_delay(parser),
        )
        content_type = response.headers.get("content-type", "").lower()
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}")
        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            raise RuntimeError("Not an HTML page")
        page = parse_page(str(response.url), response.content)
        stored = save_page(connection, page, response, queue_id=int(row["id"]))
        if stored and discover_links and row["depth"] < MAX_DEPTH:
            next_urls = [target for target, _ in page.links if urlsplit(target).netloc.lower() == urlsplit(url).netloc.lower()]
            enqueue_urls(connection, next_urls, int(row["depth"]) + 1, commit=False)
        connection.commit()
        return "complete", len(response.content), ""
    except (httpx.HTTPError, RuntimeError, UnicodeError) as exc:
        attempts = int(row["attempts"]) + 1
        state = "failed" if attempts >= MAX_ATTEMPTS else "queued"
        retry_at = datetime.fromtimestamp(time.time() + (2 ** attempts) * 60, timezone.utc).isoformat() if state == "queued" else None
        connection.execute("UPDATE crawl_queue SET state=?, attempts=?, next_attempt_at=?, last_error=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?", (state, attempts, retry_at, str(exc)[:500], utc_now(), row["id"]))
        connection.commit()
        return state, 0, str(exc)[:500]


def configure_crawler_connection(connection: sqlite3.Connection) -> None:
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=30000")
    connection.execute("PRAGMA foreign_keys=ON")


def recover_in_progress(connection: sqlite3.Connection) -> int:
    """Return interrupted work to the queue before a new run starts."""
    now = utc_now()
    cursor = connection.execute(
        """
        UPDATE crawl_queue
        SET state='queued', next_attempt_at=NULL, lease_owner=NULL, lease_expires_at=NULL,
            last_error='Recovered after crawler interruption', updated_at=?
        WHERE state='in_progress'
        """,
        (now,),
    )
    connection.commit()
    return cursor.rowcount


def claim_next(connection: sqlite3.Connection, worker_id: str) -> sqlite3.Row | None:
    """Atomically claim one ready URL so multiple workers cannot duplicate it."""
    try:
        connection.execute("BEGIN IMMEDIATE")
        now = utc_now()
        connection.execute(
            """
            UPDATE crawl_queue
            SET state='queued', next_attempt_at=NULL, lease_owner=NULL, lease_expires_at=NULL,
                last_error='Recovered after worker lease expired', updated_at=?
            WHERE state='in_progress' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
            """,
            (now, now),
        )
        row = connection.execute(
            """
            SELECT * FROM crawl_queue
            WHERE state='queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
            ORDER BY priority DESC, depth ASC, id ASC
            LIMIT 1
            """,
            (utc_now(),),
        ).fetchone()
        if row is None:
            connection.commit()
            return None
        connection.execute(
            """
            UPDATE crawl_queue
            SET state='in_progress', lease_owner=?,
                lease_expires_at=?, updated_at=?
            WHERE id=?
            """,
            (worker_id, (datetime.now(timezone.utc) + timedelta(seconds=LEASE_SECONDS)).isoformat(), now, row["id"]),
        )
        connection.commit()
        return row
    except sqlite3.Error:
        connection.rollback()
        raise


class CrawlerRuntime:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.run_id: int | None = None
        self.enabled = False
        self.discover_links = True

    @property
    def running(self) -> bool:
        return bool(self.thread and self.thread.is_alive())

    def start(self, database_path: str, *, discover_links: bool = True) -> None:
        with self.lock:
            if self.running:
                return
            self.enabled = True
            self.discover_links = discover_links
            with closing(sqlite3.connect(database_path, timeout=30)) as connection:
                configure_crawler_connection(connection)
                recover_in_progress(connection)
                queued = connection.execute(
                    "SELECT COUNT(*) FROM crawl_queue WHERE state='queued'"
                ).fetchone()[0]
                now = utc_now()
                cursor = connection.execute(
                    f"INSERT INTO {CRAWL_RUNS_TABLE} (started_at, status, pages_discovered, last_activity_at) VALUES (?, 'running', ?, ?)",
                    (now, queued, now),
                )
                connection.commit()
                self.run_id = cursor.lastrowid
            self.stop_event.clear()
            self.thread = threading.Thread(target=self._run, args=(database_path, self.run_id), name="tron-crawler", daemon=True)
            self.thread.start()

    def stop(self) -> None:
        self.enabled = False
        self.stop_event.set()

    def _run(self, database_path: str, run_id: int) -> None:
        request_limiter = HostRequestLimiter()
        concurrency_limiter = HostConcurrencyLimiter()
        try:
            with ThreadPoolExecutor(max_workers=CRAWLER_WORKERS, thread_name_prefix="tron-crawl-worker") as workers:
                futures = [
                    workers.submit(
                        self._worker,
                        database_path,
                        run_id,
                        request_limiter,
                        concurrency_limiter,
                    )
                    for _ in range(CRAWLER_WORKERS)
                ]
                for future in futures:
                    future.result()
        finally:
            with closing(sqlite3.connect(database_path, timeout=30)) as connection:
                configure_crawler_connection(connection)
                if self.stop_event.is_set():
                    recover_in_progress(connection)
                connection.execute(
                    f"UPDATE {CRAWL_RUNS_TABLE} SET status=?, finished_at=?, last_activity_at=? WHERE id=? AND status='running'",
                    ("stopped" if self.stop_event.is_set() else "complete", utc_now(), utc_now(), run_id),
                )
                connection.commit()

    def _worker(
        self,
        database_path: str,
        run_id: int,
        request_limiter: HostRequestLimiter,
        concurrency_limiter: HostConcurrencyLimiter,
    ) -> None:
        worker_id = f"worker-{os.getpid()}-{threading.get_ident()}-{uuid.uuid4().hex[:8]}"
        ca_bundle = os.getenv("TRON_CRAWLER_CA_BUNDLE", "").strip()
        verify = ca_bundle or True
        with httpx.Client(follow_redirects=False, http2=False, verify=verify) as client:
            with closing(sqlite3.connect(database_path, timeout=30)) as connection:
                configure_crawler_connection(connection)
                while not self.stop_event.is_set():
                    try:
                        row = claim_next(connection, worker_id)
                    except sqlite3.Error:
                        self.stop_event.wait(0.25)
                        continue
                    if row is None:
                        self.stop_event.wait(1)
                        continue

                    hostname = urlsplit(row["url"]).hostname or ""
                    try:
                        with concurrency_limiter.slot(hostname):
                            status, bytes_downloaded, detail = crawl_one(
                                connection,
                                client,
                                row,
                                discover_links=self.discover_links,
                                request_limiter=request_limiter,
                            )
                    except Exception as exc:  # Keep one bad page from killing the worker pool.
                        status = "failed"
                        bytes_downloaded = 0
                        detail = str(exc)[:500]
                        connection.execute(
                            "UPDATE crawl_queue SET state='failed', last_error=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=? WHERE id=?",
                            (detail, utc_now(), row["id"]),
                        )
                        connection.commit()
                    self._record_event(database_path, run_id, status, row["url"], bytes_downloaded, detail)

    def _record_event(self, database_path: str, run_id: int, status: str, url: str, bytes_downloaded: int, detail: str) -> None:
        event_type = "fetched" if status == "complete" else status
        with closing(sqlite3.connect(database_path, timeout=30)) as connection:
            connection.execute("PRAGMA busy_timeout=30000")
            connection.execute(
                f"INSERT INTO {CRAWL_EVENTS_TABLE} (run_id, event_type, url, bytes_downloaded, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (run_id, event_type, url, bytes_downloaded, detail or None, utc_now()),
            )
            connection.execute(
                f"""
                UPDATE {CRAWL_RUNS_TABLE}
                SET pages_attempted=pages_attempted+1,
                    pages_fetched=pages_fetched+?,
                    pages_stored=pages_stored+?,
                    pages_blocked=pages_blocked+?,
                    pages_failed=pages_failed+?,
                    bytes_downloaded=bytes_downloaded+?,
                    pages_discovered=(SELECT COUNT(*) FROM crawl_queue),
                    last_activity_at=?
                WHERE id=?
                """,
                (int(status == "complete"), int(status == "complete"), int(status == "blocked"), int(status in {"failed", "queued"}), bytes_downloaded, utc_now(), run_id),
            )
            connection.commit()


runtime = CrawlerRuntime()
