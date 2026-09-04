# Deployment

## Development principle

Develop and debug safely against the local version, track approved changes in GitHub, and deploy a known Git commit to the hosted tester environment.

Do not manually maintain unrelated local and hosted copies indefinitely. The goal is a traceable path from source to tester deployment.

## Local development

Known local folder:

`C:\Users\aferl\Downloads\AI-Help-Desk-2-Working-System-Health`

Run:

```powershell
node .\ai-help-desk-2-working-with-system-health.js
```

Local browser URL: `http://127.0.0.1:4173`

## Hosted deployment

The exact hosted/Cloudflare deployment procedure has **not yet been verified from the repository**. Before the next material hosted change, record:

1. Cloudflare project/Worker name.
2. Where its source currently lives.
3. Which GitHub commit corresponds to the deployed code.
4. Deployment command/workflow.
5. AI provider/model and bindings.
6. Authentication configuration.
7. Storage/telemetry configuration.
8. Usage/cost controls.
9. Verification/smoke-test procedure.

Until that audit is complete, do not claim that `main` automatically deploys to the tester site.

## Release verification

Before inviting testers to a changed release, verify at least:

- tester authentication works
- unauthorized access is rejected
- one-question/one-action behavior remains intact
- ordinary how-to questions can be answered directly
- troubleshooting sessions do not repeat questions
- escalation works
- friendly error handling works
- usage/telemetry does not expose secrets
- tester site works without Tony's laptop running

## Rollback

GitHub commit history is the rollback source. For a hosted release, record the deployed commit SHA/version. If a release fails, redeploy the previous known-good commit rather than editing production blindly.

Never delete the known local Node/Ollama fallback merely because a hosted version exists.