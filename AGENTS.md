# AGENTS.md

## Status

- **Planning phase** — no code exists yet; the stack is decided in docs, not code.
- Project: Calm Space, a voice-first web app (frontend + backend).
- Remote: https://github.com/shreyashp47/CalmSpace — implementation tracked as issues (#1–#15), scoped from `opencode-prompts.md`.

## Decided architecture (source of truth: `opencode-prompts.md`)

- Frontend: plain HTML/CSS/JS in `/public`, no build step, no framework.
- Backend: minimal Node/Express in `/server`, holds the shared default Groq key; proxies `/api/chat`, `/api/transcribe`, `/api/speak`, `/api/safety-check`.
- Dual-path keys (req 7): no user key → backend proxy with default key; user key set in localStorage (`calmspace_api_key`) → direct browser-to-Groq calls, backend never involved. CORS failure on the direct path needs a visible fallback message.
- Stateless: every visit is a fresh session; only browser-local settings persist (`calmspace_consent_seen`, `calmspace_setup_done`, `calmspace_context`, `calmspace_voice_enabled`, `calmspace_api_key`).
- Safety: independent crisis check on every message before the assistant reply; crisis UI is amber (`--accent-alert`), never red.

## Working here

- Read `requirements.md` (requirements, numbered) and `opencode-prompts.md` (Prompts 0–8) before implementing; issues reference both.
- Implement in the prompt order (Prompts 0–8) and close the matching GitHub issue per stage — do not skip ahead.
- Dark-only theme; all 8 tokens in `requirements.md` §5 are locked — do not deviate.
- Do not implement Phase 2 (session save/resume) — it needs its own requirements pass.
- Open decisions (barge-in, light mode timing, rate-limit timing, Phase 2 scope) are unresolved — see issue #15; don't silently pick one.
- Commands (verified): `npm install`, `npm start` (Express on :3000), `npm test` (node:test runner, files in `test/`). No lint/typecheck configured.