"""Infinity General Chat proxy and request contract for the TRON desktop app."""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Any

import httpx
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


DEFAULT_INFINITY_CHAT_URL = "https://api-production-45c45.up.railway.app/api/chat/instant/stream"
CHAT_TIMEOUT = httpx.Timeout(connect=15.0, read=None, write=30.0, pool=15.0)


class ChatRequest(BaseModel):
    contract: str = "general_chat.request.v2"
    request_id: str = Field(min_length=1, max_length=160)
    conversation_id: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=32_000)
    current_user_message_id: str | None = Field(default=None, max_length=160)
    model_mode: str = Field(default="mini", pattern="^(mini|standard|pro)$")
    preferences: dict[str, Any] = Field(default_factory=dict)
    explicit_capabilities: list[str] = Field(default_factory=list, max_length=32)
    constraints: list[str] = Field(default_factory=list, max_length=32)
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    thread_attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    workspace_documents: list[dict[str, Any]] = Field(default_factory=list, max_length=32)
    messages: list[dict[str, Any]] = Field(default_factory=list, max_length=80)
    memory_context: dict[str, Any] | None = None
    access_context: dict[str, Any] = Field(default_factory=dict)


def _upstream_url() -> str:
    return os.getenv("TRON_INFINITY_CHAT_URL", DEFAULT_INFINITY_CHAT_URL).strip()


def _upstream_headers() -> dict[str, str]:
    headers = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "User-Agent": "TRON-desktop-chat/1.0",
    }
    token = os.getenv("TRON_INFINITY_ACCESS_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _failure_event(request_id: str, code: str, message: str) -> bytes:
    payload = {
        "contract": "general_chat.event.v2",
        "requestId": request_id,
        "sequence": 0,
        "event": "failed",
        "response": {
            "contract": "general_chat.response.v2",
            "requestId": request_id,
            "answer": None,
            "lifecycle": {"phase": "complete"},
            "outcome": {
                "status": "failed",
                "code": code,
                "message": message,
                "retryable": True,
                "deliverableResults": [],
                "capabilityResults": [],
                "diagnostics": [],
                "auditId": f"audit-{request_id}",
            },
        },
    }
    return f"event: failed\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n".encode()


def _stream_upstream(payload: ChatRequest) -> Iterator[bytes]:
    client = httpx.Client(timeout=CHAT_TIMEOUT, follow_redirects=False)
    try:
        with client.stream(
            "POST",
            _upstream_url(),
            headers=_upstream_headers(),
            json=payload.model_dump(exclude_none=True),
        ) as response:
            if response.status_code >= 400:
                detail = "Infinity chat service rejected the request."
                try:
                    data = response.json()
                    if isinstance(data, dict) and isinstance(data.get("detail"), str):
                        detail = data["detail"][:400]
                except (ValueError, json.JSONDecodeError):
                    pass
                yield _failure_event(payload.request_id, "upstream_http_error", detail)
                return

            for chunk in response.iter_bytes():
                if chunk:
                    yield chunk
    except httpx.HTTPError:
        yield _failure_event(
            payload.request_id,
            "chat_backend_unreachable",
            "Infinity chat is temporarily unavailable. Check the chat connection and try again.",
        )
    finally:
        client.close()


def stream_chat(payload: ChatRequest) -> StreamingResponse:
    if payload.contract != "general_chat.request.v2":
        raise HTTPException(status_code=400, detail="Unsupported chat request contract.")
    return StreamingResponse(
        _stream_upstream(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
