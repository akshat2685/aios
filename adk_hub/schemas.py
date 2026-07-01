"""Structured schemas for ADK task orchestration."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Task(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    agent: str = Field(min_length=1)
    status: TaskStatus = TaskStatus.PENDING
    depends_on: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("depends_on")
    @classmethod
    def dependency_ids_must_not_be_empty(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("dependency identifiers must not be empty")
        return value


class AgentMessage(BaseModel):
    sender: str = Field(min_length=1)
    recipient: str = Field(min_length=1)
    role: Literal["user", "assistant", "system", "tool"] = "user"
    content: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(min_length=1)
    timestamp: float = Field(gt=0)


class AgentResponse(BaseModel):
    agent: str = Field(min_length=1)
    ok: bool
    output: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None

    @model_validator(mode="after")
    def failed_responses_need_error(self) -> "AgentResponse":
        if self.ok is False and not self.error:
            raise ValueError("failed responses require an error message")
        return self


class WorkflowState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    task: Task
    history: list[AgentMessage] = Field(default_factory=list)
    results: list[AgentResponse] = Field(default_factory=list)