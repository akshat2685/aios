"""Runtime wiring for the AIOS ADK hub."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
import subprocess

from google.adk.agents.llm_agent import Agent

from adk_hub.memory import SharedMemory
from adk_hub.registry import AgentDefinition, Registry, ToolDefinition
from adk_hub.schemas import AgentMessage, Task
from adk_hub.settings import HubSettings
from adk_hub.workflow import WorkflowEngine


def _timestamp() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


class HubRuntime:
    def __init__(self, settings: HubSettings | None = None) -> None:
        self.settings = settings or HubSettings()
        self.registry = Registry()
        self.memory = SharedMemory()
        self._register_defaults()
        self.workflow = WorkflowEngine({agent.name for agent in self.registry.list_agents()})

    def _register_defaults(self) -> None:
        for agent in agent_definitions():
            self.registry.register_agent(agent)
        self.registry.register_tool(
            ToolDefinition(
                name="memory.put",
                description="Store structured state for later reuse.",
                handler=lambda payload: self.memory.put(payload["key"], payload["value"]),
            )
        )

    def create_task(self, title: str, description: str, agent: str = "planner") -> Task:
        self.registry.get_agent(agent)
        return Task(id=str(uuid4()), title=title, description=description, agent=agent)

    def plan_task(self, task: Task) -> list[dict[str, Any]]:
        return [step.model_dump() for step in self.workflow.plan(task)]

    def exchange(self, sender: str, recipient: str, content: dict[str, Any], correlation_id: str) -> AgentMessage:
        self.registry.get_agent(recipient)
        return AgentMessage(sender=sender, recipient=recipient, content=content, correlation_id=correlation_id, timestamp=_timestamp())


def agent_definitions() -> list[AgentDefinition]:
    return [
        AgentDefinition(
            name="planner",
            description="Break tasks into structured work items and route them to specialists.",
            capabilities=["planning", "decomposition", "coordination"],
        ),
        AgentDefinition(
            name="research",
            description="Gather sources and synthesize findings.",
            capabilities=["search", "summarization", "source_validation"],
        ),
        AgentDefinition(
            name="coding",
            description="Generate, refactor, debug, and explain code.",
            capabilities=["code_generation", "refactoring", "debugging"],
        ),
        AgentDefinition(
            name="website",
            description="Build frontend, backend, API, and database work items.",
            capabilities=["frontend", "backend", "api_design", "database_design"],
        ),
        AgentDefinition(
            name="testing",
            description="Create and interpret unit, integration, and end-to-end tests.",
            capabilities=["unit_tests", "integration_tests", "e2e_tests"],
        ),
        AgentDefinition(
            name="security",
            description="Review dependencies, static analysis findings, and secret risks.",
            capabilities=["dependency_scanning", "static_analysis", "secret_detection"],
        ),
        AgentDefinition(
            name="docs",
            description="Produce architecture, API, and user-facing documentation.",
            capabilities=["readme", "architecture_docs", "api_docs"],
        ),
    ]


_runtime = HubRuntime()


def list_registered_agents() -> dict[str, Any]:
    return {"agents": [agent.model_dump() for agent in _runtime.registry.list_agents()]}


def create_structured_task(title: str, description: str, agent: str = "planner") -> dict[str, Any]:
    task = _runtime.create_task(title=title, description=description, agent=agent)
    return {"task": task.model_dump(mode="json"), "steps": _runtime.plan_task(task)}


def remember_fact(key: str, value: dict[str, Any]) -> dict[str, str]:
    _runtime.memory.put(key, value)
    return {"status": "stored", "key": key}


def run_agent_reach_command(command: str) -> str:
    """Run an agent-reach CLI command to search or fetch data from the internet.
    Always start the command with 'agent-reach'.
    """
    if not command.startswith("agent-reach"):
        return "Error: only agent-reach commands are allowed."
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    return result.stdout or result.stderr


def _make_specialist_agent(name: str, model: str, instruction: str) -> Agent:
    return Agent(
        model=model,
        name=f"{name}_agent",
        description=_runtime.registry.get_agent(name).description,
        instruction=instruction + " You also have access to the run_agent_reach_command tool to fetch data from the internet using agent-reach. Strictly adhere to the AIOS principles: Local-first execution, Enterprise Security, Zero Trust, Autonomous Software Engineering, high performance, low latency, and zero hallucinations.",
        mode="task",
        tools=[run_agent_reach_command]
    )


def build_root_agent() -> Agent:
    models = _runtime.settings.agent_models
    specialists = [
        _make_specialist_agent("planner", models["planner"], "Decompose goals into typed tasks and dependency-aware execution plans."),
        _make_specialist_agent("research", models["research"], "Research with sources, confidence, and concise structured summaries."),
        _make_specialist_agent("coding", models["coding"], "Implement code changes with clear boundaries and verification steps."),
        _make_specialist_agent("website", models["website"], "Design and implement frontend, backend, APIs, and database changes."),
        _make_specialist_agent("testing", models["testing"], "Create focused automated tests and explain failure signals."),
        _make_specialist_agent("security", models["security"], "Identify dependency, static-analysis, and secret-handling risks."),
        _make_specialist_agent("docs", models["docs"], "Generate accurate documentation from current code and runtime behavior."),
    ]
    return Agent(
        model=_runtime.settings.root_model,
        name="aios_hub",
        description="Structured multi-agent hub for AIOS.",
        instruction=(
            "You operate the AIOS multi-agent hub. Use structured tasks, assign work to specialist agents, "
            "and respond with concise, machine-readable outputs. "
            "Strictly adhere to the AIOS principles: Local-first execution, Enterprise Security, Zero Trust, Autonomous Software Engineering, high performance, low latency, and zero hallucinations."
        ),
        tools=[list_registered_agents, create_structured_task, remember_fact],
        sub_agents=specialists,
    )