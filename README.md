# AI Help Desk — RETIRED LEGACY REPOSITORY

> **Retired:** This repository is no longer the production source for Helpdesk Assistant. Do not deploy it to Cloudflare, connect it to production data stores, or use it for tester administration.
>
> **Production source of truth:** `aferlazzo/helpdesk-assistant`

This repository is retained only as historical reference for the earlier local Node/Ollama implementation and related experiments.

## Status

- Production application: **DO NOT USE THIS REPOSITORY**
- Cloudflare deployment: **RETIRED**
- Tester administration: **RETIRED**
- Local historical fallback/reference: retained only for source history

The former GitHub Actions workflow capable of deploying the legacy Cloudflare access gateway has been removed so this repository cannot be redeployed accidentally through that workflow.

## Historical local application

The earlier local application lived at:

`C:\Users\aferl\Downloads\AI-Help-Desk-2-Working-System-Health`

with:

`ai-help-desk-2-working-with-system-health.js`

It used Node.js, Ollama, and `qwen3:8b` and ran locally at `http://127.0.0.1:4173`.

## Current production

Use only:

`aferlazzo/helpdesk-assistant`

That repository is the authoritative production codebase for Helpdesk Assistant.

## Security

Never commit passwords, tester access codes, API keys, tokens, credentials, or private tester/customer data to this repository.
