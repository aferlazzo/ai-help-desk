# Testing

## Testing philosophy

Use automated checks for repeatable software rules and human testers for real usability. Do not waste tester time on things the program can verify itself.

## Local development checks

The current JavaScript contains controller/self-test logic for important diagnostic rules. Before a local release, also run Node syntax checking:

```powershell
node --check .\ai-help-desk-2-working-with-system-health.js
```

Then start the application and perform a short browser smoke test.

## Behavior to preserve

- exactly one diagnostic question or one action at a time
- first diagnostic question favors direct observation
- no repeated questions/evidence requests
- plain language for nontechnical users
- avoid disruptive steps until evidence justifies them
- solve when evidence is sufficient
- escalate rather than guess
- straightforward information/how-to questions may be answered directly
- scam/suspicious-message guidance must not tell a user to click suspicious links, call numbers from the message, install software, share codes, or send money

## Controlled beta

Human testers should mostly use the Help Desk naturally. Useful measurements include:

- Did the answer fix the problem?
- turns per case
- escalation rate
- response time
- errors
- platform/browser
- problem category
- application/model version

The purpose is to discover whether the Help Desk creates value for ordinary users, not to maximize the number of scripted test cases.

## Hosted smoke test

After every hosted deployment, verify access, a direct how-to question, a multi-turn troubleshooting problem, a successful solution path, an escalation path, feedback capture, and graceful handling of AI/provider failure or usage limit.