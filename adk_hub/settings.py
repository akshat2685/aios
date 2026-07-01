"""Environment-backed settings for the ADK hub."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class HubSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AIOS_ADK_", env_file=".env", extra="ignore")

    root_model: str = Field(default="gemini-3.5-flash")
    planner_model: str | None = None
    research_model: str | None = None
    coding_model: str | None = None
    website_model: str | None = None
    testing_model: str | None = None
    security_model: str | None = None
    docs_model: str | None = None

    @property
    def agent_models(self) -> dict[str, str]:
        return {
            "planner": self.planner_model or self.root_model,
            "research": self.research_model or self.root_model,
            "coding": self.coding_model or self.root_model,
            "website": self.website_model or self.root_model,
            "testing": self.testing_model or self.root_model,
            "security": self.security_model or self.root_model,
            "docs": self.docs_model or self.root_model,
        }