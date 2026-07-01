"""Registry helpers for AIOS ADK agents and tools."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ToolDefinition(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    handler: Callable[[dict[str, Any]], Any]


class AgentDefinition(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    capabilities: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)


class Registry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}
        self._tools: dict[str, ToolDefinition] = {}

    def register_agent(self, agent: AgentDefinition) -> None:
        if agent.name in self._agents:
            raise ValueError(f"agent already registered: {agent.name}")
        self._agents[agent.name] = agent

    def register_tool(self, tool: ToolDefinition) -> None:
        if tool.name in self._tools:
            raise ValueError(f"tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def get_agent(self, name: str) -> AgentDefinition:
        if name not in self._agents:
            raise KeyError(f"agent not registered: {name}")
        return self._agents[name]

    def get_tool(self, name: str) -> ToolDefinition:
        if name not in self._tools:
            raise KeyError(f"tool not registered: {name}")
        return self._tools[name]

    def list_agents(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def list_tools(self) -> list[ToolDefinition]:
        return list(self._tools.values())