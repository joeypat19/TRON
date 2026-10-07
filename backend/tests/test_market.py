import os
import unittest
from unittest.mock import patch

from app.market import (
    MARKET_SYMBOLS,
    MarketDataError,
    _extract_quotes,
    market_quotes,
    reset_market_cache,
)


class MarketTickerTests(unittest.TestCase):
    def tearDown(self):
        reset_market_cache()

    def test_batch_response_is_normalized_to_exactly_twenty_symbols(self):
        payload = {
            symbol: {
                "symbol": symbol,
                "close": str(index + 100),
                "change": "1.25",
                "percent_change": "0.75",
            }
            for index, symbol in enumerate(MARKET_SYMBOLS)
        }

        quotes = _extract_quotes(payload)

        self.assertEqual(len(quotes), 20)
        self.assertEqual([item["symbol"] for item in quotes], list(MARKET_SYMBOLS))
        self.assertEqual(quotes[0]["price"], 100.0)
        self.assertEqual(quotes[-1]["status"], "ok")

    def test_provider_quota_falls_back_to_yahoo_snapshot(self):
        fallback = {
            "status": "ok",
            "provider": "Yahoo Finance",
            "interval_seconds": 1200,
            "last_updated": "2026-10-07T00:00:00+00:00",
            "next_update_at": "2026-10-07T00:20:00+00:00",
            "symbols": [
                {
                    "symbol": symbol,
                    "price": 100.0,
                    "change": 1.0,
                    "percent_change": 1.0,
                    "status": "ok",
                }
                for symbol in MARKET_SYMBOLS
            ],
            "message": None,
        }
        with patch.dict(os.environ, {"TWELVE_DATA_API_KEY": "test-key"}, clear=False), patch(
            "app.market._fetch_quotes",
            side_effect=MarketDataError("provider quota"),
        ), patch("app.market._fetch_yahoo_quotes", return_value=fallback):
            snapshot = market_quotes()

        self.assertEqual(snapshot["provider"], "Yahoo Finance")
        self.assertEqual(len(snapshot["symbols"]), 20)
        self.assertTrue(all(item["price"] is not None for item in snapshot["symbols"]))

    def test_missing_provider_key_uses_yahoo_snapshot(self):
        fallback = {
            "status": "ok",
            "provider": "Yahoo Finance",
            "interval_seconds": 1200,
            "last_updated": "2026-10-07T00:00:00+00:00",
            "next_update_at": "2026-10-07T00:20:00+00:00",
            "symbols": [
                {
                    "symbol": symbol,
                    "price": 100.0,
                    "change": 1.0,
                    "percent_change": 1.0,
                    "status": "ok",
                }
                for symbol in MARKET_SYMBOLS
            ],
            "message": None,
        }
        with patch.dict(os.environ, {"TWELVE_DATA_API_KEY": ""}, clear=False), patch(
            "app.market._fetch_yahoo_quotes", return_value=fallback
        ):
            snapshot = market_quotes()

        self.assertEqual(snapshot["provider"], "Yahoo Finance")
        self.assertEqual(len(snapshot["symbols"]), 20)

    def test_all_providers_unavailable_returns_safe_empty_snapshot(self):
        with patch.dict(os.environ, {"TWELVE_DATA_API_KEY": ""}, clear=False):
            with patch("app.market._fetch_yahoo_quotes", side_effect=MarketDataError("offline")):
                snapshot = market_quotes()

        self.assertEqual(snapshot["status"], "unavailable")
        self.assertEqual(len(snapshot["symbols"]), 20)
        self.assertTrue(all(item["price"] is None for item in snapshot["symbols"]))


if __name__ == "__main__":
    unittest.main()
