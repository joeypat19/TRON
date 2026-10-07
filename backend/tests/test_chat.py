import json
import asyncio
import unittest
from unittest.mock import patch

from app.chat import ChatRequest, _failure_event, stream_chat


class FakeResponse:
    def __init__(self, status_code=200, chunks=None, body=None):
        self.status_code = status_code
        self._chunks = chunks or []
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def iter_bytes(self):
        return iter(self._chunks)

    def json(self):
        return self._body or {}


class FakeClient:
    response = None

    def __init__(self, *_args, **_kwargs):
        pass

    def stream(self, *_args, **_kwargs):
        return self.response

    def close(self):
        pass


class ChatContractTests(unittest.TestCase):
    @staticmethod
    async def collect(iterator):
        chunks = []
        async for chunk in iterator:
            chunks.append(chunk)
        return b"".join(chunks)

    def payload(self):
        return ChatRequest(
            request_id="request-1",
            conversation_id="conversation-1",
            current_user_message_id="message-1",
            message="Hello",
            messages=[{"role": "user", "content": "Earlier"}],
        )

    def test_request_uses_infinity_v2_contract(self):
        payload = self.payload()
        dumped = payload.model_dump()
        self.assertEqual(dumped["contract"], "general_chat.request.v2")
        self.assertEqual(dumped["current_user_message_id"], "message-1")

    def test_stream_forwards_sse_bytes(self):
        FakeClient.response = FakeResponse(
            chunks=[b'event: started\ndata: {"event":"started","sequence":0}\n\n']
        )
        with patch("app.chat.httpx.Client", FakeClient):
            response = stream_chat(self.payload())
            body = asyncio.run(self.collect(response.body_iterator))
        self.assertIn(b'"event":"started"', body)
        self.assertEqual(response.media_type, "text/event-stream")

    def test_upstream_error_becomes_structured_failure_event(self):
        FakeClient.response = FakeResponse(
            status_code=503,
            body={"detail": "upstream unavailable"},
        )
        with patch("app.chat.httpx.Client", FakeClient):
            body = asyncio.run(self.collect(stream_chat(self.payload()).body_iterator))
        event_json = body.split(b"data: ", 1)[1].split(b"\n", 1)[0]
        event = json.loads(event_json)
        self.assertEqual(event["event"], "failed")
        self.assertEqual(event["response"]["outcome"]["code"], "upstream_http_error")

    def test_failure_event_does_not_expose_configuration(self):
        event = json.loads(_failure_event("request-1", "failure", "safe message").split(b"data: ", 1)[1].split(b"\n", 1)[0])
        self.assertNotIn("TRON_INFINITY_ACCESS_TOKEN", json.dumps(event))


if __name__ == "__main__":
    unittest.main()
