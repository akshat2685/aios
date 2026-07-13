# AIOS Domain Model

This document defines the core domain vocabulary for the AI Operating System (AIOS) to ensure a shared ubiquitous language across the codebase.

## Ingestion & Memory Subsystem

- **Connector**: A stateless, pure data-fetching module (e.g., `FileSystemConnector`) that retrieves data from external sources. Connectors do not know about memory or ingestion logic.
- **ConnectorMediator**: A mediator module that orchestrates the flow of data. It starts/stops Connectors, listens to their data events, and passes raw payloads to the `DocumentIngester`.
- **DocumentIngester**: A deep module responsible for taking raw `IngestionPayload`s, performing chunking, generating deterministic UUIDs (via hashing), and writing the resulting records to the `MemoryClient`.
- **MemoryClient**: The central, unified interface for vector storage and semantic retrieval (backed by Qdrant). It handles raw CRUD and search operations for `MemoryRecord`s.
- **MemoryDomainHelpers**: A suite of pure utility functions that wrap the generic `MemoryClient` to provide strongly-typed, domain-specific operations (e.g., `saveNote`, `getGlobalPreferences`, `searchTyped`).

