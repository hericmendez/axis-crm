# Axis CRM — Engineering Rules

## Purpose

This document defines the non-negotiable engineering rules for the Axis CRM project.

These rules exist to preserve:

* architectural coherence;
* data integrity;
* security;
* maintainability;
* testability;
* reproducibility;
* safe collaboration between humans and AI agents.

These rules apply to **every developer and every AI coding agent**, regardless of model or provider.

---

# 1. Architecture Is a Contract

The existing architecture must be treated as a contract.

Do not introduce architectural changes simply because another approach appears cleaner, shorter, newer, or more fashionable.

Architectural changes require explicit justification.

Major architectural changes require an ADR.

---

# 2. No Silent Architectural Changes

An agent must never silently:

* move responsibilities between layers;
* replace a service architecture;
* introduce a new abstraction;
* remove an architectural component;
* change persistence strategy;
* replace an external integration;
* change communication patterns.

If the architecture needs to change:

```text
Proposal
→ ADR
→ Approval when required
→ Implementation
→ Tests
→ Documentation
```

---

# 3. Business Logic Must Have a Home

Business rules must live in appropriate domain/service layers.

Do not duplicate business rules across:

* WhatsApp handlers;
* controllers;
* routes;
* AI prompts;
* database models;
* utility functions.

There must be a clear source of truth for important business behavior.

---

# 4. AI Is Not Business Logic

LLMs are interpretation components, not authoritative business-rule engines.

The AI may determine:

```text
intent
event
entities
parameters
```

Application code determines:

```text
whether the operation is valid
whether it is authorized
what business rules apply
what data is changed
```

Never trust AI output without validation.

---

# 5. Validate at Boundaries

Every external boundary must be treated as untrusted.

This includes:

* WhatsApp;
* HTTP;
* LLM responses;
* MongoDB results;
* Google APIs;
* OAuth providers;
* third-party APIs.

Validate data before passing it deeper into the system.

---

# 6. Existing Contracts Must Be Preserved

Do not silently break:

* API contracts;
* service contracts;
* data schemas;
* intent schemas;
* event schemas;
* response formats;
* authentication behavior.

If a contract must change:

1. identify all consumers;
2. update tests;
3. document the change;
4. create an ADR when the change is architectural;
5. update relevant project context.

---

# 7. Tests Are Behavioral Contracts

Tests are not merely implementation details.

They define behavior that must remain stable.

Never:

* delete a test because it fails;
* weaken assertions simply to make tests pass;
* skip relevant tests without explanation;
* claim success without running the tests.

When behavior intentionally changes, update the test to represent the new contract.

---

# 8. Green Baseline Before Change

Whenever practical, establish a clean baseline before significant changes:

```text
Git status
Tests
TypeScript
Lint
Build
```

If the baseline is already failing:

* document the failures;
* distinguish existing failures from new failures;
* do not attribute pre-existing failures to the current change.

---

# 9. Regression Is a Failure

A task that introduces a regression is not complete.

When modifying an existing feature:

```text
Existing behavior
       ↓
New behavior
       ↓
Regression tests
```

Both intended new behavior and preserved existing behavior must be validated.

---

# 10. Database Integrity Is Critical

Database operations must be conservative.

Never perform destructive operations without explicit authorization.

Forbidden by default:

```text
DROP DATABASE
DROP COLLECTION
DELETE MANY
DATABASE RESET
PRODUCTION MIGRATION
PRODUCTION DATA MODIFICATION
```

unless explicitly authorized and appropriately controlled.

---

# 11. Production Is Off-Limits

AI agents must assume production is protected.

Agents must not:

* access production data unnecessarily;
* modify production data;
* delete production records;
* run destructive production commands;
* expose production credentials.

Development and test environments must be used whenever possible.

---

# 12. Secrets Never Enter the Repository

Never commit secrets.

Forbidden:

```text
API keys
passwords
JWT secrets
OAuth secrets
private keys
access tokens
refresh tokens
database credentials
```

Use environment variables or approved secret-management mechanisms.

Never include secret values in:

* source code;
* logs;
* documentation;
* Git commits;
* issue descriptions;
* test fixtures.

---

# 13. Dependencies Require Justification

Every dependency increases:

* attack surface;
* maintenance burden;
* build complexity;
* upgrade risk.

Before adding a dependency:

1. verify an existing solution is insufficient;
2. justify the dependency;
3. evaluate its role;
4. document significant architectural impact.

Do not add dependencies casually.

---

# 14. Small Changes Are Safer

Prefer:

```text
small change
→ test
→ review
→ commit
```

over:

```text
large refactor
→ many files
→ many behaviors
→ difficult review
```

Avoid unrelated cleanup during feature development.

---

# 15. Git History Is Part of the Project

Git history must remain understandable.

Commits should represent logical changes.

Avoid giant commits containing:

* feature implementation;
* unrelated refactoring;
* formatting changes;
* dependency upgrades;
* documentation rewrites.

The history should allow a future developer or AI agent to understand how the project evolved.

---

# 16. Documentation Is Part of the System

Important knowledge must not exist only inside:

* an AI conversation;
* a developer's memory;
* an issue comment;
* an ephemeral terminal session.

Important architectural and operational knowledge must be persisted in version-controlled documentation.

Primary sources include:

```text
development_context.md
AGENTS.md
docs/
docs/decisions/
```

---

# 17. ADRs Are Mandatory for Architectural Decisions

An ADR is required whenever a decision materially affects architecture or long-term technical direction.

Examples:

* changing AI architecture;
* replacing Gemini;
* changing WhatsApp providers;
* changing persistence strategy;
* introducing event-driven architecture;
* changing authentication;
* changing API boundaries;
* introducing a major dependency;
* changing module responsibilities;
* changing database strategy;
* introducing infrastructure with significant operational consequences.

ADRs belong in:

```text
docs/decisions/
```

They must be sequentially numbered.

An ADR must explain:

```text
Context
Decision
Alternatives
Consequences
```

Architectural decisions must not exist only in code.

---

# 18. Do Not Rewrite History

Agents must not rewrite Git history unless explicitly instructed.

Do not automatically use:

```text
git reset --hard
git rebase
git push --force
git push --force-with-lease
```

These operations require explicit authorization.

---

# 19. No Blind Automation

Never run destructive commands merely because they are convenient.

Before executing a command, consider:

```text
What does this command change?
What data can it affect?
Is the operation reversible?
Is authorization explicit?
```

If the answer is unclear, stop.

---

# 20. External Systems Are Failure-Prone

Assume external services can fail.

Code must account for:

```text
timeout
network failure
authentication failure
rate limiting
malformed responses
service unavailable
partial failure
duplicate requests
```

Do not treat external integrations as infallible.

---

# 21. Time and Timezones Must Be Explicit

Any feature involving:

* appointments;
* calendar events;
* reminders;
* scheduling;
* timestamps;

must explicitly consider timezone behavior.

Never rely on implicit server/local timezone assumptions.

---

# 22. Idempotency and Duplicate Operations

For operations that may be retried or delivered more than once, consider idempotency.

This is particularly important for:

* WhatsApp messages;
* lead creation;
* calendar events;
* webhook/event processing;
* external API calls.

Do not assume a request is received exactly once.

---

# 23. Observability

Important operations should be diagnosable through appropriate logs and error information.

Logs must:

* help identify failures;
* avoid exposing secrets;
* avoid unnecessary sensitive data;
* contain enough context to trace important operations.

Do not use logging as a substitute for proper error handling.

---

# 24. Security Over Convenience

When forced to choose between:

```text
quick implementation
```

and:

```text
safe implementation
```

choose the safe implementation.

Do not disable validation, authentication, authorization, or security controls merely to make development easier.

---

# 25. Unknown Is Better Than Incorrect

When an agent cannot verify something, it must say:

```text
UNKNOWN — not verified
```

It must never invent:

* files;
* APIs;
* functions;
* configuration;
* tests;
* architecture;
* historical decisions.

False confidence is considered an engineering failure.

---

# 26. Human Approval Boundaries

AI agents may implement well-defined tasks.

Human approval is required for decisions involving:

* major architecture;
* security architecture;
* production changes;
* destructive database operations;
* breaking API changes;
* irreversible infrastructure changes;
* major dependency/platform changes.

The agent must stop when an approval boundary is reached.

---

# 27. Definition of Done

A change is not considered complete until applicable criteria are satisfied:

```text
[ ] Requirement implemented
[ ] Architecture respected
[ ] Existing contracts preserved
[ ] Tests added/updated
[ ] Tests passing
[ ] TypeScript passing
[ ] Lint passing
[ ] Build passing
[ ] Documentation updated
[ ] ADR created/updated when required
[ ] No unrelated modifications
[ ] Git diff reviewed
[ ] No secrets exposed
[ ] No destructive operations performed
```

---

# 28. Model Independence

No project rule may depend on a specific AI model.

Do not encode assumptions such as:

```text
"Big Pickle understands..."
"Claude will remember..."
"Gemini knows..."
"Ox Alpha decided..."
```

Project knowledge must be expressed as explicit:

* documentation;
* tests;
* contracts;
* ADRs;
* source code;
* configuration;
* engineering rules.

The AI model is replaceable.

The engineering process is not.

---

# 29. Final Principle

> **Preserve correctness before increasing functionality.**

The Axis CRM must remain understandable, testable, secure, and internally coherent even when:

* developers change;
* AI agents change;
* models disappear;
* providers change;
* dependencies change;
* requirements evolve.

The project must never become dependent on the memory or behavior of a single agent.
