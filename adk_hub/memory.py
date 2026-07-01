"""Lightweight shared memory for the initial ADK hub implementation."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MemoryEntry(BaseModel):
    key: str = Field(min_length=1)
    value: dict[str, Any] = Field(default_factory=dict)


class SharedMemory:
    def __init__(self) -> None:
        self._entries: dict[str, dict[str, Any]] = {}

    def put(self, key: str, value: dict[str, Any]) -> None:
        if not key.strip():
            raise ValueError("memory key must not be empty")
        self._entries[key] = value

    def get(self, key: str) -> dict[str, Any] | None:
        return self._entries.get(key)

    def search(self, prefix: str) -> list[MemoryEntry]:
        return [MemoryEntry(key=k, value=v) for k, v in self._entries.items() if k.startswith(prefix)]