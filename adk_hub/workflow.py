"""Workflow engine for structured agent coordination."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from adk_hub.schemas import AgentMessage, AgentResponse, Task, TaskStatus, WorkflowState


class WorkflowStep(BaseModel):
    agent: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class WorkflowEngine:
    def __init__(self, valid_agents: set[str]) -> None:
        self.valid_agents = valid_agents

    def plan(self, task: Task) -> list[WorkflowStep]:
        if task.agent not in self.valid_agents:
            raise ValueError(f"unknown workflow agent: {task.agent}")
        return [
            WorkflowStep(agent=task.agent, payload={"task_id": task.id, "title": task.title, "description": task.description}),
        ]

    def start(self, task: Task) -> WorkflowState:
        self.plan(task)
        task.status = TaskStatus.IN_PROGRESS
        return WorkflowState(task=task)

    def record_message(self, state: WorkflowState, message: AgentMessage) -> None:
        state.history.append(message)

    def record_result(self, state: WorkflowState, result: AgentResponse) -> None:
        state.results.append(result)
        state.task.status = TaskStatus.COMPLETED if result.ok else TaskStatus.FAILED