"""Shared cached market quotes for the TRON desktop ticker."""

from __future__ import annotations

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx

from .crawler import crawler_verify_value


MARKET_SYMBOLS = (
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "AVGO",
    "AMD",
    "NFLX",
    "ORCL",
    "JPM",
    "V",
    "WMT",
    "COST",
    "LLY",
    "MA",
    "XOM",
    "PLTR",
    "INTC",
)
MARKET_UPDATE_INTERVAL_SECONDS = max(
    300, int(os.getenv("TRON_MARKET_UPDATE_INTERVAL_SECONDS", "1200"))
)
MARKET_PROVIDER_URL = "https://api.twelvedata.com/quote"
YAHOO_CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart/{}"
YAHOO_MAX_WORKERS = 8
YAHOO_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
}

_cache_lock = threading.Lock()
_refresh_lock = threading.Lock()
_cache: dict[str, Any] | None = None


class MarketDataError(RuntimeError):
    """A safe, user-facing market-data failure without provider details."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _empty_symbols() -> list[dict[str, Any]]:
    return [
        {
            "symbol": symbol,
            "price": None,
            "change": None,
            "percent_change": None,
            "status": "unavailable",
        }
        for symbol in MARKET_SYMBOLS
    ]


def _unavailable(message: str, *, timestamp: datetime | None = None) -> dict[str, Any]:
    updated = timestamp or _now()
    return {
        "status": "unavailable",
        "provider": "Twelve Data",
        "interval_seconds": MARKET_UPDATE_INTERVAL_SECONDS,
        "last_updated": updated.isoformat(),
        "next_update_at": (updated + timedelta(seconds=MARKET_UPDATE_INTERVAL_SECONDS)).isoformat(),
        "symbols": _empty_symbols(),
        "message": message,
    }


def _as_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _quote_item(symbol: str, raw: Any) -> dict[str, Any]:
    item = raw if isinstance(raw, dict) else {}
    price = _as_number(item.get("close", item.get("price")))
    change = _as_number(item.get("change"))
    percent_change = _as_number(item.get("percent_change", item.get("percentChange")))
    return {
        "symbol": symbol,
        "price": price,
        "change": change,
        "percent_change": percent_change,
        "status": "ok" if price is not None else "unavailable",
    }


def _extract_quotes(payload: Any) -> list[dict[str, Any]]:
    """Normalize Twelve Data single and batch response shapes."""

    if not isinstance(payload, dict):
        raise MarketDataError("The market-data provider returned an invalid response.")
    if payload.get("status") == "error" or payload.get("code"):
        raise MarketDataError("The market-data provider rejected the quote request.")

    raw_by_symbol: dict[str, Any] = {}
    if isinstance(payload.get("data"), list):
        for item in payload["data"]:
            if isinstance(item, dict) and item.get("symbol"):
                raw_by_symbol[str(item["symbol"]).upper()] = item
    elif payload.get("symbol"):
        raw_by_symbol[str(payload["symbol"]).upper()] = payload
    else:
        for key, item in payload.items():
            if isinstance(item, dict):
                symbol = str(item.get("symbol") or key).upper()
                raw_by_symbol[symbol] = item

    return [_quote_item(symbol, raw_by_symbol.get(symbol)) for symbol in MARKET_SYMBOLS]


def _fetch_quotes(api_key: str) -> dict[str, Any]:
    now = _now()
    params = {
        "symbol": ",".join(MARKET_SYMBOLS),
        "apikey": api_key,
    }
    try:
        with httpx.Client(
            timeout=20,
            follow_redirects=True,
            verify=crawler_verify_value(),
        ) as client:
            response = client.get(MARKET_PROVIDER_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise MarketDataError(
                "The market-data provider rate limit is too low for 20 symbols in one snapshot."
            ) from exc
        raise MarketDataError("The market-data provider rejected the quote request.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise MarketDataError("The market-data provider could not be reached.") from exc

    symbols = _extract_quotes(payload)
    available = sum(item["status"] == "ok" for item in symbols)
    if not available:
        raise MarketDataError("The market-data provider returned no usable quotes.")
    return {
        "status": "ok" if available == len(symbols) else "partial",
        "provider": "Twelve Data",
        "interval_seconds": MARKET_UPDATE_INTERVAL_SECONDS,
        "last_updated": now.isoformat(),
        "next_update_at": (now + timedelta(seconds=MARKET_UPDATE_INTERVAL_SECONDS)).isoformat(),
        "symbols": symbols,
        "message": None if available == len(symbols) else "Some quotes were unavailable.",
    }


def _fetch_yahoo_symbol(client: httpx.Client, symbol: str) -> dict[str, Any]:
    """Fetch one current quote from Yahoo's public chart metadata endpoint."""

    response = client.get(
        YAHOO_CHART_URL.format(quote(symbol, safe="")),
        params={"range": "1d", "interval": "1d"},
    )
    response.raise_for_status()
    payload = response.json()
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    meta = result.get("meta") if isinstance(result, dict) else None
    if not isinstance(meta, dict):
        raise MarketDataError("Yahoo Finance returned no quote metadata.")

    price = _as_number(meta.get("regularMarketPrice"))
    previous_close = _as_number(meta.get("chartPreviousClose"))
    change = None if price is None or previous_close is None else price - previous_close
    percent_change = _as_number(meta.get("regularMarketChangePercent"))
    if percent_change is None and change is not None and previous_close:
        percent_change = change / previous_close * 100
    return {
        "symbol": symbol,
        "price": price,
        "change": change,
        "percent_change": percent_change,
        "status": "ok" if price is not None else "unavailable",
    }


def _fetch_yahoo_quotes() -> dict[str, Any]:
    """Build the same shared snapshot using Yahoo chart metadata as a fallback."""

    now = _now()
    symbols = _empty_symbols()
    with httpx.Client(
        headers=YAHOO_HEADERS,
        timeout=12,
        follow_redirects=True,
        verify=crawler_verify_value(),
    ) as client:
        with ThreadPoolExecutor(max_workers=YAHOO_MAX_WORKERS) as executor:
            futures = {
                executor.submit(_fetch_yahoo_symbol, client, symbol): index
                for index, symbol in enumerate(MARKET_SYMBOLS)
            }
            for future in as_completed(futures):
                index = futures[future]
                try:
                    symbols[index] = future.result()
                except (httpx.HTTPError, ValueError, MarketDataError):
                    continue

    available = sum(item["status"] == "ok" for item in symbols)
    if not available:
        raise MarketDataError("No market-data provider returned usable quotes.")
    return {
        "status": "ok" if available == len(symbols) else "partial",
        "provider": "Yahoo Finance",
        "interval_seconds": MARKET_UPDATE_INTERVAL_SECONDS,
        "last_updated": now.isoformat(),
        "next_update_at": (now + timedelta(seconds=MARKET_UPDATE_INTERVAL_SECONDS)).isoformat(),
        "symbols": symbols,
        "message": "Using the fallback market-data provider." if available < len(symbols) else None,
    }


def market_quotes() -> dict[str, Any]:
    """Return one shared snapshot, refreshing it only after its 20-minute TTL."""

    global _cache
    now = _now()
    with _cache_lock:
        cached = _cache
        if cached is not None:
            try:
                last_updated = datetime.fromisoformat(cached["last_updated"])
            except (KeyError, TypeError, ValueError):
                last_updated = datetime.min.replace(tzinfo=timezone.utc)
            if (now - last_updated).total_seconds() < MARKET_UPDATE_INTERVAL_SECONDS:
                return cached

    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        try:
            refreshed = _fetch_yahoo_quotes()
        except MarketDataError:
            with _cache_lock:
                _cache = _unavailable(
                    "Market data is not configured on this TRON backend yet."
                )
                return _cache
        with _cache_lock:
            _cache = refreshed
            return _cache

    if not _refresh_lock.acquire(blocking=False):
        with _cache_lock:
            return _cache or _unavailable("Market data is refreshing. Try again shortly.")
    try:
        try:
            refreshed = _fetch_quotes(api_key)
        except MarketDataError as exc:
            try:
                refreshed = _fetch_yahoo_quotes()
            except MarketDataError:
                with _cache_lock:
                    if _cache and _cache.get("status") in {"ok", "partial"}:
                        stale = dict(_cache)
                        stale["message"] = str(exc)
                        stale["stale"] = True
                        return stale
                    _cache = _unavailable(str(exc))
                    return _cache
        with _cache_lock:
            _cache = refreshed
            return _cache
    finally:
        _refresh_lock.release()


def reset_market_cache() -> None:
    """Reset the process cache for isolated tests."""

    global _cache
    with _cache_lock:
        _cache = None
