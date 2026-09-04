# Architecture

## Purpose

AI Help Desk is designed to help nontechnical users with ordinary technology problems without sending them on speculative or disruptive troubleshooting paths.

## Core diagnostic flow

**ASK → SOLVE → ESCALATE**

1. ASK one highest-value observable question.
2. Record the answer as evidence and do not ask for it again.
3. SOLVE when the evidence supports one safe, specific action.
4. ESCALATE when the remaining path would be speculative, repetitive, risky, administrator-level, hardware-level, or unnecessarily disruptive.

Straightforward information/how-to questions may be answered directly rather than entering diagnostic flow.

## Verified local architecture

```text
Browser
  ↓
Node.js HTTP server
127.0.0.1:4173
  ↓
Diagnostic controller + in-memory session state
  ↓
Ollama local API
127.0.0.1:11434/api/chat
  ↓
qwen3:8b
```

The Node application also invokes Windows PowerShell locally to collect System Health information. This feature is Windows-specific.

## Local session state

Troubleshooting sessions are currently held in an in-memory JavaScript `Map`. A Node restart therefore clears active local sessions. This is acceptable for the local development build but should not be assumed appropriate for a production service.

## Windows System Health

The local application can collect selected machine information such as Windows/computer information, disk capacity, Wi-Fi state, audio device, printers, Windows Security state, pending restart/update information, and Windows device problems. Some values may intentionally be unavailable rather than guessed.

## Hosted tester architecture — verification required

The hosted/Cloudflare tester version exists for remote beta access, but this repository currently contains only the verified local application. Before treating the hosted build as production-equivalent, document and verify:

- exact Cloudflare project/Worker
- deployed source and commit
- AI provider and model
- whether AI inference is Cloudflare Workers AI or another service
- authentication/access-control mechanism
- session persistence
- usage/rate limits
- billing account and cost boundary
- telemetry/storage locations
- rollback procedure

Do not assume ChatGPT Plus, Cloudflare Workers, Workers AI, Ollama, and Codex/Work usage are interchangeable. They are separate services/usage paths unless the implementation explicitly connects them.

## Intended target architecture

```text
Local development
Node + Ollama + Qwen
       ↓ tested changes
GitHub main (source of truth)
       ↓ controlled deployment
Hosted tester service
       ↓
Approved authenticated testers
```

Testers should require only the hosted URL and their authorized access method.