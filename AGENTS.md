# ProctorX Development Policy

## Scope

This policy applies to development work in ProctorX. It is an internally vetted, non-runtime engineering guideline inspired by the minimal-change approach documented by Ponytail.[1] It does **not** install, execute, or depend on the third-party Ponytail repository, lifecycle hooks, plugins, package scripts, or agent instructions.

## Decision Ladder

Before adding code, first determine whether the work is necessary. Then prefer, in order: an existing ProctorX implementation, browser or platform capability, installed dependency, a small focused extension, and only then a new abstraction. Read the relevant code paths and data model before choosing an approach.

## Non-Negotiable Safeguards

Minimal code never overrides correctness. Preserve authorization boundaries, input validation, data migrations, privacy notices, accessibility, auditability, explicit user consent for device permissions, responsive behavior, automated coverage, and release validation. Do not remove error handling or tests merely to reduce code size.

## Runtime Boundary

Do not add Ponytail hooks, plugins, instructions, packages, or network calls to the ProctorX client, server, Capacitor Android wrapper, student exam experience, or administrator dashboards. The production application must remain independent of the downloaded third-party repository.

## Project Workflow

For each user-requested feature, update `todo.md` before implementation, make the smallest safe change, add or update automated tests, run `pnpm test`, `pnpm check`, and `pnpm build`, verify relevant UI behavior, and save a checkpoint before delivery.

## Reference

[1]: https://github.com/DietrichGebert/ponytail "DietrichGebert/ponytail"
