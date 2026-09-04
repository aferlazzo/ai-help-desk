# Known Issues

This file tracks product/deployment issues that are worth remembering. Do not put passwords, secrets, or private tester conversations here.

## Open

### Hosted architecture not yet tied to this repository

The current repository contains the verified local Node/Ollama application. The Cloudflare tester deployment has not yet been audited against this source. Its deployed source, AI provider/model, authentication, usage limits, billing path, and rollback process must be documented.

### Local System Health is Windows-specific

The PowerShell System Health collector is Windows-specific. The Help Desk conversation itself can discuss other platforms, but local automatic System Health collection should not be assumed to work on Mac, iPhone, Android, or other systems.

### Local sessions are in memory

Restarting the local Node process clears active troubleshooting session state.

### Some System Health values are intentionally unavailable

For example, exact speaker mute/volume state is not reliably available through the simple built-in Windows management interfaces used by the current implementation. The application should report unavailable values rather than invent them.

## Resolved

Move items here when fixed, with the release/version or commit when practical.