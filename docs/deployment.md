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

## Hosted tester access gateway

The repository now contains a Cloudflare Worker access gateway in `cloudflare/worker.js` plus a manual GitHub Actions deployment workflow in `.github/workflows/deploy-cloudflare-gateway.yml`.

The gateway is intentionally separate from the troubleshooting engine. It sits in front of the hosted Help Desk and provides controlled-beta access:

- approved tester registration by name and email
- a unique high-entropy invitation token per tester
- only the SHA-256 token hash is stored in Cloudflare KV
- secure HttpOnly session cookie after successful invitation use
- lifecycle state moves to `Setup` when an invitation is issued and `Active` after first successful access
- immediate `Disabled` state for revocation
- all ordinary Help Desk paths are blocked unless a valid tester session exists
- administrative endpoints require a separate secret bearer token

### Cloudflare resources required

Before first deployment create or identify:

1. A Cloudflare Workers KV namespace for tester records.
2. A Cloudflare API token permitted to deploy this Worker.
3. The Cloudflare account ID.
4. The verified hosted Help Desk origin URL that the gateway will protect and proxy to.
5. A strong Help Desk admin token.
6. A separate strong session-signing secret.

### GitHub deployment configuration

Configure these GitHub Actions repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `HELP_DESK_ADMIN_TOKEN`
- `HELP_DESK_SESSION_SECRET`

Configure this GitHub Actions repository variable:

- `HELP_DESK_ORIGIN_URL`

Do not put the actual values in tracked files.

The deployment workflow is deliberately **manual (`workflow_dispatch`)** until these settings have been verified. This avoids generating failed-deployment emails on ordinary repository pushes.

### Tester registration API after deployment

`POST /admin/testers`

Authenticated with:

`Authorization: Bearer <HELP_DESK_ADMIN_TOKEN>`

JSON body:

```json
{
  "name": "Tester Name",
  "email": "tester@example.com"
}
```

The gateway returns a unique `inviteUrl`. That URL is what goes in the tester welcome email. Never save the returned raw invitation token in GitHub.

Other administrative operations:

- `GET /admin/testers` — list testers without token hashes
- `POST /admin/testers/disable` with `{ "email": "tester@example.com" }` — revoke access

The public `/health` endpoint may be used for a simple gateway smoke test.

## Remaining hosted-origin audit

The exact existing hosted Help Desk origin still must be verified before the gateway is deployed. Record:

1. Current hosted project/Worker/site name.
2. Where its source currently lives.
3. Which GitHub commit, if any, corresponds to that deployed code.
4. AI provider/model and bindings.
5. Storage/telemetry configuration.
6. Usage/cost controls.

Do not point the gateway at an assumed origin URL.

## Release verification

Before inviting testers to a changed release, verify at least:

- `/health` returns success
- unauthorized access to `/` is rejected
- a newly registered tester receives a unique invitation URL
- the invitation URL establishes a secure session and redirects to the Help Desk
- the tester becomes `Active` after first successful access
- disabling the tester invalidates subsequent session requests
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
