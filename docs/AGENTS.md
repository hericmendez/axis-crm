# AGENTS.md

## Axis CRM — AI Coding Agent Instructions

This file defines the operating instructions for any AI coding agent working on the Axis CRM project.

These instructions are **model-agnostic**. They apply regardless of which AI model, provider, or coding agent is being used.

---

# 1. Source of Truth

Before making changes, always read:

```text
development_context.md
```

This file contains the accumulated development history, current state, architectural context, decisions, constraints, and relevant project knowledge.

Also inspect:

```text
docs/
```

when relevant to the task.

The source code is the final authority for the implementation.

If documentation and implementation disagree:

1. Do not silently choose one.
2. Identify the discrepancy.
3. Determine whether the difference is intentional.
4. If the discrepancy affects architecture or behavior, stop and ask for clarification.
5. Update documentation only after the intended behavior is established.

Never invent missing context.

If something cannot be verified, explicitly state:

```text
UNKNOWN — not verified
```

---

# 2. Engineering Rules

Before working on the project, read:

```text
docs/engineering-rules.md
```

These rules are mandatory.

If a task conflicts with an engineering rule, do not silently violate the rule.

Explain the conflict and request clarification when necessary.

---

# 3. Understand Before Editing

Never immediately start modifying files after receiving a task.

For non-trivial changes:

1. Read the relevant documentation.
2. Inspect the relevant source files.
3. Identify the current implementation.
4. Identify affected modules.
5. Identify affected contracts.
6. Determine existing tests.
7. Formulate an implementation plan.
8. Explain the plan before making significant changes.

Do not modify unrelated files.

---

# 4. Task Scope

Keep every change narrowly scoped to the requested task.

Do not use a task as an excuse to:

* refactor unrelated code;
* rename unrelated files;
* reorganize the project;
* upgrade dependencies;
* change architecture;
* rewrite working code;
* modify unrelated tests;
* change configuration unnecessarily.

If you discover an unrelated problem, report it separately.

Do not fix it unless explicitly requested.

---

# 5. Architecture

Respect the existing Axis architecture.

Do not introduce a new architectural pattern merely because it appears cleaner or more modern.

Before introducing:

* a new service;
* a new abstraction;
* a new persistence mechanism;
* a new dependency;
* a new communication layer;
* a new AI abstraction;
* a new external integration;

verify whether the existing architecture already provides an appropriate solution.

Prefer extending existing abstractions over duplicating business logic.

---

# 6. Business Logic

Business rules belong in appropriate domain/service layers.

Avoid placing business logic directly inside:

* HTTP handlers;
* WhatsApp event handlers;
* controllers;
* AI prompt code;
* database models;
* infrastructure adapters.

External integrations should be isolated behind appropriate services or adapters.

The AI layer must not become the source of truth for business rules.

The LLM interprets user intent.

Application code determines what is actually allowed to happen.

---

# 7. AI / Intent System

Treat AI output as **untrusted external input**.

Never assume that an LLM response is valid merely because the model was instructed to return a specific format.

AI responses must be validated before reaching business logic.

Pay particular attention to:

* intent;
* event;
* required fields;
* identifiers;
* dates;
* times;
* user information;
* confidence/ambiguity where applicable.

Unknown or malformed AI output must fail safely.

Never allow an invalid AI response to directly trigger destructive or irreversible operations.

---

# 8. Data and Persistence

Never perform destructive database operations unless explicitly requested and the operation is known to be safe.

Never:

* delete production data;
* reset a database;
* drop collections;
* run destructive migrations;
* modify production records;

without explicit authorization.

Database changes must be:

1. intentional;
2. documented when relevant;
3. tested;
4. reversible where reasonably possible.

If a schema change is required, evaluate migration implications before implementation.

---

# 9. External Integrations

Axis may depend on external systems such as:

* WhatsApp;
* Gemini/LLM services;
* MongoDB;
* Google Calendar;
* OAuth providers;
* other APIs documented by the project.

Treat external services as unreliable boundaries.

Always consider:

* timeout;
* unavailable service;
* malformed response;
* authentication failure;
* rate limiting;
* network failure;
* partial failure;
* duplicated requests;
* inconsistent external state.

Never assume an external API call succeeded merely because no immediate exception was thrown.

---

# 10. Secrets

Never expose or commit:

```text
.env
API keys
access tokens
refresh tokens
passwords
JWT secrets
OAuth credentials
private keys
database credentials
```

Never print secret values to the terminal, logs, commits, documentation, or AI responses.

If environment configuration must be inspected, verify only whether required variables exist.

---

# 11. Testing

Every behavioral change must be validated.

Before implementation:

```text
Understand current behavior
```

After implementation:

```text
Run relevant tests
Run type checking
Run lint
Run build
```

Use the commands defined by the project.

Do not invent test commands if equivalent project scripts already exist.

Never consider a task complete merely because the code compiles.

If a test fails:

1. Investigate the failure.
2. Determine whether the failure is related to the change.
3. Fix the underlying problem if it belongs to the task.
4. Do not weaken or remove tests merely to obtain a green result.

---

# 12. Regression Protection

Existing behavior must remain stable unless the task explicitly changes it.

When modifying an existing behavior:

1. Identify existing tests.
2. Determine the intended new behavior.
3. Update tests accordingly.
4. Add regression coverage where appropriate.

Never silently change an API contract.

---

# 13. Git Workflow

Agents must work on a feature/fix branch whenever possible.

Do not directly modify `main` for implementation work.

Before starting:

```bash
git status
```

Before finishing:

```bash
git status
git diff
```

Review the complete diff.

Do not include unrelated changes.

Do not commit unless explicitly requested.

Do not push to a remote repository unless explicitly authorized.

---

# 14. Commits

When commits are requested:

* make commits small;
* keep one logical change per commit;
* use meaningful commit messages;
* do not mix refactoring with feature work;
* do not include generated files unless intentionally required.

A commit should be understandable without relying on the agent's conversation history.

---

# 15. Architecture Decision Records (ADR)

Architectural decisions must be documented.

Create ADRs when a change affects or establishes:

* system architecture;
* module boundaries;
* data models;
* persistence strategy;
* external integrations;
* authentication/authorization;
* AI architecture;
* major dependencies;
* API contracts;
* communication patterns;
* infrastructure;
* security architecture;
* irreversible or difficult-to-reverse technical decisions.

ADRs must be stored in:

```text
docs/decisions/
```

Use sequential filenames:

```text
ADR-001-description.md
ADR-002-description.md
ADR-003-description.md
```

Before creating a new ADR:

1. Inspect existing ADRs.
2. Determine the next available number.
3. Check whether an existing ADR already covers the decision.
4. Update an existing ADR instead of creating a duplicate when appropriate.

Each ADR should contain:

```text
# ADR-NNN — Title

## Status

Proposed / Accepted / Superseded / Deprecated

## Context

What problem or decision needs to be addressed?

## Decision

What was decided?

## Alternatives Considered

What alternatives were evaluated?

## Consequences

What are the positive and negative consequences?

## Related Documentation

Links or references to relevant project documentation.
```

### ADR workflow

For significant architectural decisions:

```text
Understand
    ↓
Identify architectural impact
    ↓
Review existing ADRs
    ↓
Propose decision
    ↓
Create ADR
    ↓
Obtain approval when required
    ↓
Implement
    ↓
Update development_context.md
```

Do not silently make a major architectural decision and document it afterward as though it had already been approved.

If the decision requires human approval, stop before implementation.

---

# 16. Documentation Maintenance

When implementation changes project behavior, update the relevant documentation.

At minimum consider:

```text
development_context.md
docs/
ADRs
API documentation
testing documentation
```

Do not blindly rewrite `development_context.md`.

Preserve useful historical information.

Document:

* what changed;
* why it changed;
* current behavior;
* important constraints.

---

# 17. Dependency Changes

Do not add, remove, or upgrade dependencies without justification.

Before adding a dependency:

1. Check whether existing dependencies already solve the problem.
2. Evaluate maintenance and security implications.
3. Explain why the dependency is necessary.
4. Update relevant documentation when appropriate.

Avoid dependency changes during unrelated tasks.

---

# 18. Error Handling

Errors should be:

* handled at the appropriate layer;
* logged appropriately;
* useful for debugging;
* safe for users.

Never expose:

* stack traces;
* secrets;
* database credentials;
* internal tokens;
* sensitive implementation details

to end users.

Do not use silent error swallowing.

---

# 19. Security

Treat all external input as untrusted.

Validate:

* HTTP input;
* WhatsApp messages;
* AI output;
* identifiers;
* dates;
* user-provided data;
* external API responses.

Follow least-privilege principles.

When you discover a security issue:

* classify it;
* explain its impact;
* avoid exploiting it;
* fix it only when the task authorizes security remediation.

---

# 20. Completion Protocol

Before declaring a task complete, verify:

```text
[ ] Requirements satisfied
[ ] Relevant documentation reviewed
[ ] Architecture respected
[ ] No unrelated files modified
[ ] Tests pass
[ ] TypeScript passes
[ ] Lint passes
[ ] Build passes
[ ] Relevant documentation updated
[ ] ADR created/updated when required
[ ] Git diff reviewed
[ ] No secrets exposed
[ ] No destructive operations performed
```

If any item cannot be verified, explicitly report it.

Never claim a test passed if it was not actually executed.

Never claim an implementation is complete if important validation remains undone.

---

# 21. Communication Style

When reporting work:

1. State what was changed.
2. Explain why.
3. Mention files affected.
4. Mention tests executed.
5. Report failures honestly.
6. Report unresolved risks.
7. Identify documentation or ADR changes.

Be concise but technically precise.

Never hide uncertainty.

Never fabricate evidence.

---

# 22. Golden Rule

When uncertain:

> **Stop, inspect, explain, and ask.**

The safest agent is not the one that changes the most code.

The safest agent is the one that preserves the integrity, coherence, and long-term maintainability of the Axis CRM project.
