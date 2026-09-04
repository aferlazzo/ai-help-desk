# Configuration

## Verified local configuration

| Setting | Current local value |
|---|---|
| Host | `127.0.0.1` |
| Port | `4173` |
| Ollama endpoint | `http://127.0.0.1:11434/api/chat` |
| Model | `qwen3:8b` |
| Maximum diagnostic questions | `6` |
| Session storage | in memory |
| System Health platform | Windows |

The current local values are defined in the JavaScript source. Future refactoring should move environment-specific values to configuration/environment variables where useful.

## Local prerequisites

- Windows for full System Health functionality
- Node.js
- Ollama
- `qwen3:8b` pulled into Ollama

## Secrets

Do not put secrets in source code or documentation. This includes:

- API keys
- passwords
- access codes
- authentication tokens
- private tester credentials

Hosted secrets should use the hosting platform's secret-management mechanism. Local secrets, if introduced, should use environment variables or another ignored local configuration mechanism.

## Hosted configuration — to be audited

Record these values after the hosted implementation is verified:

- Cloudflare project/Worker name
- public tester URL
- AI provider
- model name
- AI endpoint/binding
- rate/turn limits
- hard usage/spending ceiling if supported
- authentication method
- session/data storage
- telemetry configuration
- application version

Do not publish secret values in this file.