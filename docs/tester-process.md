# Controlled Beta Tester Process

## Goal

Give a small number of approved people access to the hosted AI Help Desk while keeping approval, usage, privacy, support, and revocation under control.

## Tester lifecycle

**Requested → Approved → Setup → Active → Disabled**

1. **Request** — prospective tester texts Tony their name and email address.
2. **Approval** — Tony alone approves or denies access.
3. **Setup** — after approval, authorized technical setup/configuration is completed and access is verified.
4. **Welcome** — Tony sends the standardized approval/welcome package containing the tester URL, access/setup/use instructions, tester guide, privacy/safety notice, testing expectations, and problem-reporting instructions.
5. **Active testing** — tester uses the hosted Help Desk as an ordinary user. Do not turn testers into formal QA staff with a large scripted checklist.
6. **Problem report** — tester reports a problem to Tony. A screenshot and case/session ID should be included when useful. Tony passes the report for technical diagnosis.
7. **Disable** — Tony may revoke a tester's access at any time.

## Access requirements

Use unique tester access rather than a single shared password whenever the hosted architecture permits it. A tester should never need:

- Tony's laptop
- Tony's ChatGPT account
- Node.js
- Ollama
- GitHub knowledge
- Cloudflare knowledge
- software installation solely to access the hosted Help Desk

## Session/case identification

Each troubleshooting session should eventually receive a simple case ID so a reported problem can be tied to the correct session without requiring the tester to reconstruct the entire conversation.

## Beta telemetry target

Capture only what is useful for improving the product, including where appropriate:

- tester/account identifier
- case/session ID
- timestamp
- platform/browser
- problem category
- number of turns
- model/version used
- response time
- application version
- errors
- escalation outcome
- `Did that fix it? Yes / No`
- optional reason after `No`

Do not put private tester conversations into repository documentation.

## Owner dashboard target

Provide an administrative view showing at minimum active testers, sessions, AI turns/requests, successful resolutions, escalations, errors, and estimated AI usage/cost when the hosted AI provider exposes enough information.

## Usage safety

The hosted beta should have a kill switch and a hard usage/spending ceiling where technically supported. When a service limit is reached, show a friendly user-facing message rather than a raw provider error.