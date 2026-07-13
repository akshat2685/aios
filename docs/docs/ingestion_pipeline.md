# Event-Driven Ingestion Pipeline

The AIOS Event-Driven Ingestion Pipeline is designed for high-throughput, low-latency processing. It safely ingests real-time data streams, enriches them using RAG context, and distributes events to the Multi-Agent Swarm.

## Architecture Diagram

```mermaid
graph TD
    classDef external fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#333;
    classDef queue fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px,color:#333;
    classDef processor fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#333;
    classDef storage fill:#e8f5e9,stroke:#4caf50,stroke-width:2px,color:#333;

    Client["Client / Sensors"]:::external --> |HTTPS / gRPC| API_Gateway["API Gateway"]:::processor
    
    API_Gateway --> |Raw Events| Event_Bus["Event Bus (Kafka/Redpanda)"]:::queue
    
    Event_Bus --> |Subscribe| Validator["Schema Validator"]:::processor
    Validator --> |Valid Events| Enrichment["RAG Enrichment Node"]:::processor
    Validator --> |Invalid Events| DLQ["Dead Letter Queue"]:::queue
    
    Enrichment --> |Query| AgentDB[("AgentDB (Vector Store)")]:::storage
    AgentDB --> |Context| Enrichment
    
    Enrichment --> |Enriched Events| Action_Router["Intelligent Task Router"]:::processor
    
    Action_Router --> |Simple Tasks| T1_Workers["Tier 1 Workers"]:::processor
    Action_Router --> |Complex Tasks| T3_Workers["Tier 3 Swarm"]:::processor
    
    T1_Workers --> |Store Results| DataLake[("Data Lake")]:::storage
    T3_Workers --> |Store Results| DataLake
```

## Key Components

1. **API Gateway**: Handles rate limiting, authentication, and initial payload acceptance.
2. **Event Bus**: The resilient backbone ensuring zero data loss and decoupled consumer scaling.
3. **Schema Validator**: Drops or reroutes malformed data to the Dead Letter Queue.
4. **RAG Enrichment Node**: Interrogates the AgentDB to attach semantic context to raw events.
5. **Intelligent Task Router**: Decides which LLM tier or Swarm agent is best equipped to handle the event.
