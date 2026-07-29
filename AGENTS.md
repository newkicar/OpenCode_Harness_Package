# OpenCode Harness Package — Agent Guide

This is an **OpenCode harness package** — a reusable starter kit of rules, plugins, workflows, and skills for OpenCode projects. The harness *is* the product; there is no application source code.

---

## What this repo is

- A **skeleton/template** you copy into new projects to bootstrap OpenCode standards
- Files in `memory/` are **placeholders** with template content — edit or replace them for the target project
- Rules in `.rules/` are loaded automatically by `opencode.json`; plugin TypeScript in `.opencode/plugins/` must be compiled

---

## Terminology

> **Before acting on a bold term**, read `.rules/GLOSSARY.md` to confirm its definition. Don't guess — terms like *Hook 审计*, *Smoke Test*, *L2 领域规则* have precise meanings in this harness.

---

## File layout (what matters)

| Path | Role |
|------|------|
| `opencode.json` | Project's OpenCode config. References `AGENTS.md` as agent prompt, loads `.rules/` as instructions |
| `.rules/00-core.md` | **Single source of truth** for security, TDD, anti-patterns, delivery checklist |
| `.rules/01-ponytail.md` | Lazy senior dev mode — minimal code, root-cause fixes, boring over clever |
| `.rules/better-errors.md` | First-response error classification table (PYTHON-DEP, FILE-NOT-FOUND, etc.) |
| `.rules/workflows/*.md` | Task-specific workflows (error-rescue, baseline-startup, risk-gates, etc.) |
| `.rules/l2/*.md` | **Auto-loaded** domain rules. Detected by project signals (see below) |
| `.opencode/plugins/*.ts` | PreToolUse (security intercept), PostToolUse (audit), TodoEnforcer |
| `.agents/skills/` | Local skill definitions (bdd-practices, karpathy-guidelines, etc.) |
| `memory/` | Cross-session state: progress, decisions (ADRs) |
| `.scratch/` | Specs & issue tracker (local markdown). See `docs/agents/issue-tracker.md` |

---

## Commands

```bash
# Type-check and build the OpenCode plugins
cd .opencode && npx tsc --noEmit   # typecheck only
cd .opencode && npx tsc            # build (outputs JS)
cd .opencode && npm test           # run plugin tests (test-plugins.js)

# Markdown lint (from repo root)
markdownlint '**/*.md' --ignore node_modules

# Python verification (only relevant if the target project uses Python)
pytest                             # or python -m pytest
ruff check .                       # lint
ruff format .                      # format
```

**Important**: The plugin directory `.opencode/` has its own `package.json` and `tsconfig.json`. All plugin work must run from `cd .opencode`. CI validates the full matrix: `tsc --noEmit` → JSON validation → markdownlint → `npm test`.

---

## Auto-loading of L2 rules

The AI scans for signals and loads the matching `.rules/l2/*.md` when present:

| Signal | Loads |
|--------|-------|
| Code mentions `create_deep_agent(` | `02-deepagents-code-rule.md` |
| `import torch` or `pyproject.toml` with torch | `03-pytorch-code-rule.md` |
| `.specify/extensions.yml` exists | Activates speckit/ workflow suite |
| None of the above | No L2 rules (this project type) |

---

## Key workflow facts

- **Risk-aware**: Always classify the task first (`.rules/workflows/task-risk-gates.md`). Small fixes skip heavy governance; schema/db/deploy work requires full process.
- **Error first response**: Match tool errors to `better-errors.md` §1 (PYTHON-DEP, FILE-NOT-FOUND, etc.). If 2+ self-fix cycles fail, escalate to `error-rescue.md`.
- **Session-end**: Notify user before ending a session so progress is tracked. Update `memory/progress.md` with completed items and next steps.
- **No silent seed data**: Never auto-write seed data at startup. Require explicit call or env var.

---

## Gotchas

- **No application code exists.** `pytest`/`ruff` commands are placeholders for the target project. This repo only has TypeScript plugins and Markdown.
- **Plugins must be compiled.** The `.ts` files in `.opencode/plugins/` are source; `tsc` produces `.js` that the runtime loads. Always run `tsc` after editing a plugin.
- **Memory files are templates.** `memory/progress.md`, `memory/decisions.md` contain example content — replace it with real data, don't append to the template.
- **AGENTS.md is the agent prompt.** It's loaded via `opencode.json` → `agent.build.prompt = "{file:./AGENTS.md}"`. Keep it compact.
- **Rules are loaded automatically.** The `opencode.json` `instructions` array loads `.rules/*.md` and `workflows/*.md` on every session. The AGENTS.md should not duplicate what those rules already state.

---

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles with default label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` at repo root). See `docs/agents/domain.md`.
