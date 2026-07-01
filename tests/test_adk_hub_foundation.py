from __future__ import annotations

import unittest

from pydantic import ValidationError

from adk_hub.runtime import HubRuntime, build_root_agent, create_structured_task, list_registered_agents, remember_fact
from adk_hub.schemas import AgentResponse, Task


class AdkHubFoundationTest(unittest.TestCase):
    def test_runtime_registers_all_foundation_agents(self) -> None:
        runtime = HubRuntime()

        names = {agent.name for agent in runtime.registry.list_agents()}

        self.assertEqual(names, {"planner", "research", "coding", "website", "testing", "security", "docs"})

    def test_task_creation_validates_agent_and_plans_step(self) -> None:
        runtime = HubRuntime()
        task = runtime.create_task("Build foundation", "Create the core runtime contracts.", agent="coding")

        steps = runtime.plan_task(task)

        self.assertEqual(task.agent, "coding")
        self.assertEqual(
            steps,
            [
                {
                    "agent": "coding",
                    "payload": {
                        "task_id": task.id,
                        "title": "Build foundation",
                        "description": "Create the core runtime contracts.",
                    },
                }
            ],
        )

    def test_task_rejects_empty_boundary_fields(self) -> None:
        with self.assertRaises(ValidationError):
            Task(id="", title="", description="", agent="")

    def test_failed_agent_response_requires_error(self) -> None:
        with self.assertRaises(ValidationError):
            AgentResponse(agent="testing", ok=False)

    def test_adk_root_agent_constructs_without_live_api_key(self) -> None:
        agent = build_root_agent()

        self.assertEqual(agent.name, "aios_hub")
        self.assertEqual(
            {sub_agent.name for sub_agent in agent.sub_agents},
            {
                "planner_agent",
                "research_agent",
                "coding_agent",
                "website_agent",
                "testing_agent",
                "security_agent",
                "docs_agent",
            },
        )

    def test_structured_tools_are_local_and_deterministic(self) -> None:
        agents = list_registered_agents()
        task = create_structured_task("Plan work", "Split the implementation into typed subtasks.")
        memory_result = remember_fact("test.fact", {"ok": True})

        self.assertEqual(len(agents["agents"]), 7)
        self.assertEqual(task["task"]["agent"], "planner")
        self.assertEqual(task["steps"][0]["agent"], "planner")
        self.assertEqual(memory_result, {"status": "stored", "key": "test.fact"})


if __name__ == "__main__":
    unittest.main()