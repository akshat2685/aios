# Multi-Agent Swarm Topology

The AIOS Swarm uses a **Hierarchical-Mesh** topology to balance strict oversight with dynamic, parallel collaboration.

## Topology Diagram

```mermaid
graph TB
    classDef lead fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#333;
    classDef manager fill:#ffecb3,stroke:#ffa000,stroke-width:2px,color:#333;
    classDef worker fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#333;
    
    Lead["Swarm Lead (Orchestrator)"]:::lead
    
    subgraph Core Engineering
        Arch["System Architect"]:::manager
        Dev["Backend Developer"]:::worker
        Sec["Security Auditor"]:::worker
    end
    
    subgraph Data Science
        Analyst["Data Analyst"]:::manager
        Researcher["Codebase Researcher"]:::worker
    end
    
    subgraph Quality Assurance
        Tester["Test Engineer"]:::manager
        Reviewer["Code Reviewer"]:::worker
    end
    
    Lead -->|Delegate Architecture| Arch
    Lead -->|Delegate Analysis| Analyst
    Lead -->|Delegate Testing| Tester
    
    Arch <-->|Mesh Sync| Dev
    Arch <-->|Security Review| Sec
    
    Analyst <-->|Context Share| Researcher
    
    Dev <-->|Submit for Test| Tester
    Tester <-->|Review Results| Reviewer
    Reviewer <-->|Code Feedback| Dev
    
    %% Mesh capabilities for cross-domain awareness
    Sec -.->|Audit Findings| Reviewer
    Researcher -.->|Patterns| Arch
```

## Architectural Highlights

- **Hierarchical Oversight**: The `Swarm Lead` orchestrates the high-level goals, delegating complex sub-tasks to domain-specific Managers.
- **Mesh Collaboration**: Workers within and across domains communicate directly (`SendMessage`) without continually bottlenecking the Lead.
- **Anti-Drift Mechanisms**: Managers enforce adherence to the original goal, preventing agents from falling into hallucination loops.
- **Dynamic Spawning**: The Swarm can scale horizontally, spawning new workers when the task queue grows.
