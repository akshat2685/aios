# Product Requirements Document

## AI SOC Platform for API and Application Abuse Detection

**Owner:** Product  
**Status:** Draft  
**Date:** June 11, 2026  
**Audience:** Product, Engineering, Security Operations, Data Science, Design, GTM

## 1. Executive Summary

Build a next-generation Security Operations Center platform focused on detecting and responding to abuse that traditional SIEM/SOC tools often miss. The product will combine security telemetry, behavioral analytics, classical ML, and LLM-assisted workflows to detect:

- API security abuse
- Application security abuse
- Account takeover
- OTP/SMS pumping and abuse
- Bot activity
- Credential stuffing
- Business logic abuse
- Automated incident triage and investigation

The platform should not compete as a generic SIEM replacement on day one. It should win by being materially better at understanding identity, device, session, API, and business-flow behavior.

## 2. Problem Statement

Existing SOC platforms are strong at endpoint, network, and cloud alerts, but they are weak at:

- detecting abuse hidden inside application workflows
- understanding business objects and business flows
- correlating identity, device, and session signals across apps and APIs
- catching low-and-slow abuse that does not look like malware
- separating false positives from real abuse quickly enough to reduce analyst load

Security teams need a platform that can ingest rich application telemetry, detect abuse patterns in near real time, and explain findings in analyst-friendly language.

## 3. Product Vision

Create an AI-native SOC platform that acts as the operating layer for abuse detection and incident triage across applications, APIs, identity systems, and response tools.

The platform should:

- detect abuse earlier than traditional tools
- reduce manual alert triage
- correlate evidence into a clear attack story
- automate safe response actions
- improve over time through analyst feedback

## 4. Goals and Non-Goals

### Goals

- Detect credential stuffing, OTP abuse, bot activity, and business-flow abuse with high confidence.
- Ingest and normalize security telemetry from web, API, auth, WAF, cloud, DNS, and application systems.
- Correlate related alerts into incidents with a unified timeline and evidence graph.
- Use AI to summarize, prioritize, and guide investigation without replacing deterministic controls.
- Provide response actions such as block, step-up auth, throttle, and ticket creation.
- Deliver a dashboard that security and fraud teams can use without deep model expertise.
- **Immediate Autonomous Response:** Automatically and instantly perform actions to block and stop attacks as soon as they are recognized.
- **Attacker Deterrence:** Automatically generate a detailed intelligence report on the attacker and send an email directly to them containing their exposed footprint.

### Non-Goals

- Replacing the customer’s SIEM on day one.
- Performing full vulnerability management or SAST/DAST scanning as the primary product.
- Building a generic chatbot without grounded evidence.
- Holding response actions for human approval; the platform must default to autonomous action.

## 5. Target Users

### Primary Personas

- SOC Analyst: investigates alerts and closes incidents
- Detection Engineer: builds and tunes detections
- Security Manager: monitors trends, KPIs, and workload
- Application Security Engineer: tracks abuse patterns in APIs and user flows
- Fraud / Trust and Safety Analyst: monitors abuse against accounts and transactions

### Secondary Personas

- Incident Responder
- Cloud Security Engineer
- Product Security Lead
- Executive Stakeholder

## 6. Core Use Cases

1. Detect credential stuffing against login endpoints and identity providers.
2. Detect OTP/SMS pumping and abuse against verification and signup flows.
3. Detect bot-driven scraping, enumeration, and automated form abuse.
4. Detect account takeover through abnormal login patterns and session reuse.
5. Detect business logic abuse such as coupon abuse, workflow abuse, and order manipulation.
6. Detect API abuse such as object enumeration, rate abuse, and authorization probing.
7. Auto-triage low-confidence alerts into clear incident narratives.
8. Automatically execute the next best action to block ongoing attacks immediately.
9. Compile a comprehensive attacker report and automatically email the attacker to deter further abuse.

## 7. Product Principles

- Evidence first: every conclusion must be backed by telemetry.
- Grounded AI: LLM outputs must cite underlying events or records.
- Autonomous execution: the system defaults to immediate, automated mitigation without waiting for human approval.
- Tenant-aware learning: customer-specific baselines matter.
- Abuse-focused: optimize for business and identity abuse, not only malware.
- Fast time-to-value: usable detections should work before full model tuning.

## 8. Scope

### MVP Scope

- Alert ingestion
- Alert correlation
- AI alert triage
- OTP abuse detection
- Credential stuffing detection
- Dashboard
- Autonomous response and mitigation
- Automated attacker intelligence reporting and email deterrence

### Phase 2 Scope

- Agentic investigations
- Threat intelligence integration
- LLM SOC assistant
- Additional abuse models for bot detection, account takeover, and business logic abuse

## 9. Functional Requirements

### 9.1 Data Collection

The platform must ingest:

- web server logs
- API gateway logs
- authentication logs
- WAF logs
- cloud logs
- DNS logs
- application logs
- OTP/SMS delivery and verification logs

Each event should support:

- timestamp
- tenant identifier
- entity identifiers
- source system
- request/session metadata
- outcome/status
- latency and volume metrics
- geo and device context where available

### 9.2 Normalization and Entity Resolution

The system must normalize incoming telemetry into a canonical schema and link events to:

- user
- account
- session
- device
- IP address
- API key
- token
- phone number
- object/resource ID
- business flow / funnel step

### 9.3 Detection Engine

The detection engine must support:

- rules
- thresholds
- statistical anomaly detection
- supervised classification
- sequence-based detection
- graph-based correlation

It should support both:

- single-event detections
- multi-event detections across time windows

### 9.4 AI Triage

The AI triage layer must:

- summarize the alert in plain language
- list the key evidence
- identify related events
- estimate severity and confidence
- recommend the next action
- explain why the alert is likely true, false, or benign positive

The LLM must not invent facts that are not present in the evidence set.

### 9.5 Investigation Workspace

The platform must provide:

- incident timeline
- correlated entities
- alert clustering
- evidence graph
- raw event drill-down
- similar-case lookup
- analyst notes and verdict capture

### 9.6 Response Engine

The platform should support response actions such as:

- step-up authentication
- temporary account lock
- IP/device throttling
- API key throttling
- session revocation
- OTP send suppression
- ticket creation
- SOAR handoff
- Automated attacker email notifications

For the MVP, the platform must execute response actions (such as blocking or throttling) immediately and autonomously upon recognizing an attack. It must also compile a detailed attacker profile and automatically send a deterrence email directly to the attacker.

### 9.7 Dashboard and Reporting

The dashboard must show:

- alert volume
- incident counts
- abuse trends by app, endpoint, and tenant
- top affected accounts and flows
- detection precision and false positives
- response outcomes
- cost impact of OTP or abuse events

## 10. Data Requirements

### Required Telemetry Fields

- actor identifiers: user ID, account ID, phone number, device ID
- request identifiers: request ID, session ID, correlation ID
- auth context: login result, MFA result, token state
- request context: method, path, object ID, route, status code
- network context: source IP, ASN, geo, proxy/VPN indicators
- device context: user agent, fingerprint, browser, app version
- business context: checkout, signup, OTP request, password reset, coupon use
- response context: challenge result, block result, step-up result

### Data Quality Requirements

- timestamps must be normalized to UTC
- duplicate events must be deduplicated
- schema drift must be detected
- missing critical fields must be flagged
- tenant isolation must be enforced

## 11. Detection Strategy

### Recommended Model Stack

1. Rules and heuristics for known abuse patterns
2. Classical ML for tabular risk scoring
3. Sequence models for event-order anomalies
4. Graph correlation for attack chains and shared entities
5. LLMs for summarization and guided investigation

### Recommended Algorithms

- Isolation Forest for unsupervised outlier detection
- Random Forest for stable classification on smaller labeled sets
- XGBoost for high-precision abuse scoring
- One-Class SVM for constrained novelty detection
- LSTM or Transformer models for session and flow sequences
- Autoencoders for reconstruction-based anomaly detection

### Detection Outputs

Each detection should emit:

- alert title
- severity
- confidence
- attack type
- entity list
- evidence list
- recommended response
- explanation text

## 12. AI Requirements

### LLM Use Cases

- alert summarization
- incident triage
- attack-chain reconstruction
- analyst Q&A over grounded evidence
- report generation for stakeholders

### AI Guardrails

- retrieval only from approved evidence sources
- prompt injection filtering
- schema validation on model output
- confidence thresholds for auto-summarization
- fail closed when evidence is insufficient

## 13. Architecture Overview

```text
Sources -> Ingestion -> Normalization -> Feature Store / Graph Store -> Detection Engine
         -> AI Triage -> Investigation Workspace -> Response Engine -> Dashboard
```

### Layer Responsibilities

- Data Collection Layer: ingest and buffer telemetry
- Processing Layer: parse, enrich, deduplicate, sessionize
- Detection Engine: rules + ML + graph + sequence scoring
- AI Engine: grounded summarization and investigation assistance
- Investigation Engine: timelines, evidence graph, related cases
- Response Engine: throttling, revocation, ticketing, SOAR
- Dashboard Layer: operational and executive reporting

## 14. Success Metrics

### Detection Metrics

- precision by abuse type
- recall by abuse type
- false positive rate
- time to detect
- time to triage

### Operational Metrics

- mean time to investigate
- mean time to contain
- analyst hours saved
- alert-to-incident correlation rate
- percentage of alerts auto-summarized

### Business Metrics

- reduction in OTP waste
- reduction in credential stuffing success rate
- reduction in manual SOC workload
- reduction in abuse-related customer impact

## 15. Competitive Positioning

The product should differentiate on:

- application and API abuse detection depth
- business-flow awareness
- OTP and credential abuse specialization
- grounded AI triage instead of generic chat
- strong analyst workflow and response actions

Competitors are already strong in endpoint, network, and generic SOC copilots. The gap is application-native abuse detection with SOC-grade investigation and response.

## 16. Risks and Mitigations

### Risk: Insufficient telemetry

Mitigation: define minimum viable event schema and provide SDK / pipeline guidance.

### Risk: Model drift

Mitigation: tenant-level baselines, retraining triggers, drift monitoring.

### Risk: False positives on abuse detections

Mitigation: layered scoring, feedback loops, and staged rollout.

### Risk: LLM hallucination

Mitigation: evidence grounding, constrained prompts, and fail-closed behavior.

### Risk: Over-automation and False Positives in Autonomous Response

Mitigation: Implement strict confidence thresholds for autonomous blocking and automated attacker emails. Provide a fast "undo" mechanism for analysts if a benign user is blocked.

## 17. MVP Delivery Plan

### Release 1

- ingestion for auth, API, WAF, app, and OTP logs
- normalization and entity resolution
- credential stuffing detection
- OTP abuse detection
- alert correlation
- LLM-based alert summaries
- analyst dashboard

### Release 2

- bot detection
- account takeover scoring
- business logic abuse detection
- response automations with approvals
- threat intelligence enrichment

### Release 3

- autonomous investigations
- agentic response workflows
- cross-tenant learning with privacy controls
- advanced graph analytics and attack-chain reconstruction

## 18. Open Questions

- Which identity providers and API gateways are most common in the target market?
- What minimum telemetry can be assumed in the first customer segment?
- Should the product launch as SaaS, hybrid, or customer-managed deployment?
- What response actions are allowed without human approval by policy?
- Which vertical should be targeted first: fintech, SaaS, e-commerce, or consumer apps?

## 19. Recommendation

Launch the product as an **AI SOC platform for application and API abuse detection**, not as a generic SOC copilot. Start with credential stuffing and OTP abuse because they have clear telemetry, clear business pain, and measurable ROI. Add AI triage early, but keep detections grounded in deterministic and ML-backed signals.

