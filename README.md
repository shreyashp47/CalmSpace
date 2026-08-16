# Calm Space

A voice-first browser app that helps you regain mental peace after an argument, conflict, or stressful moment. You talk or type about what happened; the assistant listens, reflects it back, guides a short grounding exercise, and gently helps reframe the situation — so you can get back to your day calmer.

**This is not therapy.** It is not a replacement for a licensed professional and is not equipped to handle emergencies. It is a decompression aid for everyday stress.

## Status

**MVP implemented** — issues #1–#10 are closed and covered by 64 automated tests. Remaining: pre-launch hardening (#11 accessibility, #12 mobile responsiveness, #13 rate limiting), Phase 2 (#14), and open decisions (#15).

Implementation is tracked as GitHub issues, scoped from the prompts in `opencode-prompts.md`:

- **MVP** (issues #1–#10): consent/settings flow, voice chat with live captions and TTS, structured AI conversation arc, crisis detection
- **Pre-launch hardening** (issues #11–#13): accessibility, mobile responsiveness, rate limiting
- **Phase 2** (issue #14): session save/summarize/resume

## Architecture

- **Frontend**: plain HTML/CSS/JS, no build step, no framework — served from `/public`
- **Backend**: minimal Node/Express server in `/server` that holds the shared default Groq API key server-side and proxies chat, transcription, and TTS (Whisper, PlayAI)
- **Privacy (dual-path API keys)**: without a user key, requests go through the backend proxy using the default key. If the user supplies their own key in settings, all calls go **directly from the browser to Groq** — the key never touches our server (req 7)
- **Stateless by design**: every visit is a brand-new session; only browser-local settings persist, never conversation content
- **Safety**: every message passes an independent crisis check before the assistant replies; on risk, coaching stops and calm, amber-styled resources (988/911) are shown

## Design

Dark-only "Deep calm" theme with locked tokens (see `requirements.md` §5). Color is reserved for meaning — the central orb state indicator and the crisis banner — and the alert state never uses red.

## Quickstart

```bash
npm install
npm start        # serves http://localhost:3000 (frontend from /public, API on /api/*)
npm test         # node:test runner
```

Copy `.env.example` to `.env` and set `GROQ_API_KEY` before adding API routes (issue #6).

## Docs

- [`requirements.md`](requirements.md) — functional, safety, non-functional, and design requirements
- [`opencode-prompts.md`](opencode-prompts.md) — step-by-step implementation plan (Prompts 0–8)
- [`AGENTS.md`](AGENTS.md) — guidance for AI coding agents working in this repo