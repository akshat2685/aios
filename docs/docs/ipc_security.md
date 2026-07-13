# IPC Security Architecture

AIOS utilizes a Zero-Trust Inter-Process Communication (IPC) model. Agents, background workers, and memory components are strictly isolated, communicating solely over authenticated, encrypted channels.

## Security Diagram

```mermaid
sequenceDiagram
    participant AgentA as Agent Node A
    participant IPC as IPC Broker / Mesh
    participant IAM as Identity & Access Mgr
    participant AgentB as Agent Node B

    AgentA->>IAM: Request Token (mTLS + JWT)
    IAM-->>AgentA: Grant Ephemeral Token
    
    Note over AgentA,IPC: Encrypted Channel (TLS 1.3)
    AgentA->>IPC: Publish Message [Token, Payload]
    
    IPC->>IAM: Validate Token & Scopes
    IAM-->>IPC: Validation Success
    
    IPC->>AgentB: Deliver Message
    Note over IPC,AgentB: Delivery only if AgentB has Subscribe scopes
    
    AgentB->>IPC: Acknowledge Receipt
    IPC-->>AgentA: Delivery Confirmed
```

## Core Security Pillars

- **mTLS Everywhere**: All node-to-node communication is encrypted at the transport layer.
- **Ephemeral Identity**: Agents are issued short-lived JWTs, reducing the attack surface.
- **Sandboxing**: Agents run in restricted environments with no direct network access; all external connections route through a hardened gateway.
- **Payload Inspection**: The IPC Broker scans payloads for PII and restricted content before routing.
