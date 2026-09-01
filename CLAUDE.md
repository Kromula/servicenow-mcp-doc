# Claude Instructions — ServiceNow MCP Orchestrator

## ServiceNow SDK Reference — Required for Every Task

This project has the **ServiceNow marketplace plugins** installed in Claude Code, exposing the
`fluent:now-sdk-explain` and `fluent:now-sdk-setup` skills. These provide authoritative SDK
documentation (API types, metadata conventions, project structure, skills) directly from ServiceNow.

**Rule:** For every task involving this MCP — ServiceNow APIs, fluent applications, ACLs,
business rules, UI actions, table schemas, UX analysis, or anything ServiceNow-specific —
consult `fluent:now-sdk-explain` before answering or making changes.

How to apply:
- Start with `fluent:now-sdk-explain` (no topic) to browse available topics, then drill in with
  a specific topic relevant to the task (e.g. ACLs, business rules, metadata).
- If the command is not found or errors, run `fluent:now-sdk-setup` first.
- Cite/reference what the SDK docs say when it shapes the answer — don't silently rely on
  general knowledge when the SDK is the source of truth.
- This applies even to "quick" questions; ServiceNow conventions change between versions and
  the SDK docs are the canonical reference.

## UX Analysis — Guideline File Prompt

When asked to run a UX analysis (e.g. `analyze_ux`) on any view (ESC, Portal, Workspace, General)
**without a specific guideline file being mentioned**, do NOT run the analysis immediately.

Instead, prompt the user to choose which guideline to run against:

> "Which guideline file would you like to run the analysis against?
> 1. **Design & Visual UX** — `Design-Visual-UX-Guidelines.md`
> 2. **ServiceNow UX** — `servicenow-ux-guidelines.md`
> 3. **WCAG 2.2 Level AA** — `wcag-2.2-level-aa.md`
> 4. **WCAG 2.2 Level AAA** — `wcag-2.2-level-aaa.md`"

Running without a specific guideline file will default to all files and significantly increases runtime.
