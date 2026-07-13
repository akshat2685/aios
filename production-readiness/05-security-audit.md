# Security Audit

**Threat Model:** Addressed privilege escalation and prompt injection.
**Prompt Injection:** Active sanitization guards implemented.
**Plugin Sandbox:** Access to fs/child_process stripped from guest plugins.
**IPC:** Protected by ephemeral Bearer tokens.