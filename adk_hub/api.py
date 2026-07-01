"""FastAPI boundary for the AIOS ADK hub."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from adk_hub.runtime import HubRuntime


class CreateTaskRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    agent: str = Field(default="planner", min_length=1)


class MemoryPutRequest(BaseModel):
    key: str = Field(min_length=1)
    value: dict[str, Any] = Field(default_factory=dict)


class MessageRequest(BaseModel):
    sender: str = Field(min_length=1)
    recipient: str = Field(min_length=1)
    content: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(min_length=1)


def create_app(runtime: HubRuntime | None = None) -> FastAPI:
    hub = runtime or HubRuntime()
    app = FastAPI(title="AIOS ADK Hub", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "agents": len(hub.registry.list_agents())}

    @app.get("/agents")
    def list_agents() -> dict[str, Any]:
        return {"agents": [agent.model_dump() for agent in hub.registry.list_agents()]}

    @app.get("/tools")
    def list_tools() -> dict[str, Any]:
        return {"tools": [{"name": tool.name, "description": tool.description} for tool in hub.registry.list_tools()]}

    @app.post("/tasks")
    def create_task(request: CreateTaskRequest) -> dict[str, Any]:
        try:
            task = hub.create_task(request.title, request.description, request.agent)
            return {"task": task.model_dump(mode="json"), "steps": hub.plan_task(task)}
        except KeyError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    @app.post("/messages")
    def create_message(request: MessageRequest) -> dict[str, Any]:
        try:
            message = hub.exchange(request.sender, request.recipient, request.content, request.correlation_id)
            return {"message": message.model_dump(mode="json")}
        except KeyError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    @app.post("/memory")
    def put_memory(request: MemoryPutRequest) -> dict[str, str]:
        try:
            hub.memory.put(request.key, request.value)
            return {"status": "stored", "key": request.key}
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    @app.get("/memory/{key}")
    def get_memory(key: str) -> dict[str, Any]:
        value = hub.memory.get(key)
        if value is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="memory key not found")
        return {"key": key, "value": value}

    @app.get("/memory")
    def search_memory(prefix: str = "") -> dict[str, Any]:
        return {"entries": [entry.model_dump() for entry in hub.memory.search(prefix)]}

    return app


app = create_app()
