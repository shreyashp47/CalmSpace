# Calm Space — OpenCode implementation prompts

A voice-first browser app that helps someone regain mental peace after an argument or stressful moment. Each prompt below is meant to be pasted into OpenCode **one at a time, in order** — building incrementally works far better with agentic coding tools than one giant prompt, since you can review and correct each stage before moving on.

## Assumptions (change before you start if these don't fit)

- **Stack**: plain HTML/CSS/JS frontend, no build step, no framework — simplest to review and modify by hand. Swap this out in Prompt 0 if you'd rather use React/Vite.
- **Backend**: a minimal Node/Express server whose only job is to hold your default Groq API key server-side (so it's never exposed in browser source). If the user supplies their own key in settings, calls go straight from the browser to Groq instead, bypassing your server entirely — this is what makes the "privacy" option real.
- **AI provider**: Groq, using one model for chat, Whisper for speech-to-text, and a PlayAI voice for text-to-speech.
- **Theme**: dark-only ("Deep calm" palette below). No light mode for v1.

## Locked design tokens — Deep calm

```
--bg-page: #0B1412
--bg-surface: #14201E
--bg-control: #1D2C29
--accent-primary: #6FBFA0   /* idle / listening */
--accent-speaking: #5FA3AE  /* AI speaking — must look distinct from listening */
--accent-alert: #D9A55B     /* crisis banner + orb — never red */
--text-primary: #E8ECEA
--text-secondary: #8FA39E
--icon-on-accent: #12201D   /* icon color when sitting on a filled accent circle */
```

## Requirements this build must satisfy

1. Every visit starts a brand-new chat — no history stored or reloaded across visits.
2. First-ever visit shows a consent/disclaimer screen, then a settings screen, before entering chat.
3. A local-only flag (`localStorage`, not a server) remembers setup is done — no conversation content stored.
4. Settings stay reachable afterward via a small icon.
5. Input: type or speak. Speaking shows **live captions** in the input box in real time; nothing auto-sends — user reviews and sends manually.
6. Assistant replies in text **and** voice (TTS). Voice has an on/off toggle in settings.
7. Default free Groq key built in; user can add their own key in settings, stored client-side only, sent directly to Groq (never touching your server).
8. Conversation follows a structured arc: vent → reflect → grounding exercise → gentle reframe → close. Not open-ended freeform chat.
9. Crisis-language detection runs on every user message. If triggered, interrupt the normal flow and show a crisis banner + real resources (988, 911, "contact someone you trust") instead of continuing to coach.
10. The assistant stays neutral about who was "right" in the argument — it only ever addresses the user's emotional state, never validates or condemns the other party.
11. The assistant only engages with emotional/mental-peace content. It acknowledges but declines unrelated tasks (coding, finance advice, trivia, etc.) and redirects back to how the person is feeling.
12. Clear loading states for STT, LLM response, and TTS generation — never silent dead air.
13. Graceful error handling: mic permission denied, invalid/rate-limited API key, no internet.
14. Explicit session-end action, not just "close the tab."

---

## Prompt 0 — Project scaffold

```
Create a new project called "calm-space". Set up:
- A Node/Express backend in /server that will later proxy requests to the Groq API. For now just a health-check route at GET /api/health returning { status: "ok" }.
- A static frontend in /public served by Express: index.html, styles.css, app.js — no build tooling, no framework.
- .env.example with a GROQ_API_KEY placeholder. .env itself must be gitignored.
- A README explaining how to run it locally (npm install, npm start).
Do not implement any UI yet — just confirm the server runs and serves a blank index.html.
```

## Prompt 1 — Global design system

```
In styles.css, set up the Calm Space design system as CSS custom properties on :root:

--bg-page: #0B1412;
--bg-surface: #14201E;
--bg-control: #1D2C29;
--accent-primary: #6FBFA0;
--accent-speaking: #5FA3AE;
--accent-alert: #D9A55B;
--text-primary: #E8ECEA;
--text-secondary: #8FA39E;
--icon-on-accent: #12201D;

Dark theme only — set body background to var(--bg-page), text color to var(--text-primary).
Use a clean, calm sans-serif font stack. Generous whitespace, no sharp shadows, no bright saturated colors anywhere outside these tokens. Border radius should feel soft (12-16px on cards, fully round on buttons/orb).
Do not build any screens yet, just the base stylesheet and a typography/spacing scale as comments for reference.
```

## Prompt 2 — Consent/disclaimer screen

```
Build the first screen a user ever sees: a consent/disclaimer screen, shown only once (before settings), gated by a localStorage flag "calmspace_consent_seen".

Content:
- Short, warm explanation: this app helps you process stress after an argument or hard moment.
- Clear statement: this is not therapy, not a replacement for a licensed mental health professional, and not equipped to handle emergencies.
- Note: don't share identifying personal details (full name, address, etc.) — nothing typed here is stored on our server beyond the current session.
- A single "I understand, continue" button that sets the localStorage flag and moves to the settings screen (build that screen as an empty placeholder for now — we'll fill it in next).

Style it using the design tokens from styles.css. Centered card layout, calm and unhurried, no urgency-inducing colors.
```

## Prompt 3 — Settings screen

```
Build the settings screen. It appears automatically right after consent on first visit (gated by a separate localStorage flag "calmspace_setup_done"), and is also reachable anytime afterward via a small gear icon in the top corner of the chat screen.

Fields:
1. Open text field: "Anything you'd like the assistant to know before we start?" (optional, freeform, placeholder text, not required to proceed)
2. Voice reply toggle: on/off switch, default ON, label "Speak replies out loud"
3. API key field: optional text input, label "Use your own Groq API key (optional, for privacy)". Explain in small muted text: "If left blank, we'll use a shared free key. Your own key is stored only in your browser and is never sent to our server."
4. "Save and continue" button — on first-time flow this sets calmspace_setup_done=true and moves to the chat screen; from the gear icon it just saves and returns to chat.

Store all of these values in localStorage under clearly named keys (calmspace_context, calmspace_voice_enabled, calmspace_api_key). Do not send any of this to the backend yet — that comes in a later prompt.
Style consistently with the consent screen — same card layout, same tokens.
```

## Prompt 4 — Main chat screen UI (visual only, no AI yet)

```
Build the main chat screen UI to match this structure (no AI wiring yet — just the interface and its visual states):

- Top bar: "Calm space" title left, gear icon right (opens settings screen from Prompt 3).
- Center: a large circular "orb" element with an icon inside, plus a status text label beneath it. It needs four visual states, switchable via a JS function setOrbState(state) for now (we'll wire real triggers later):
  - "idle": fill var(--accent-primary), mic icon, status text "Tap to speak"
  - "listening": same fill, mic icon, gentle pulse animation (scale 1 → 1.08, 1.4s loop), status text "Listening..."
  - "speaking": fill var(--accent-speaking), a "volume" icon, pulse animation (1.8s loop), status text "Speaking..."
  - "crisis": fill var(--accent-alert), a "heart" icon, no pulse, status text "We hear you. You are not alone." — and reveal a banner above the top bar (background tinted var(--accent-alert) at low opacity, text var(--accent-alert)) reading: "Feeling unsafe? Call or text 988, or reach out to someone you trust." This banner must NOT use red anywhere.
- Bottom input row: a text input (placeholder "Type how you're feeling..."), a mic button, and a send button. Mic and send are separate controls — do not auto-send from voice input.
- Below the orb, add a scrollable message list area (user + assistant messages, simple bubble style using bg-surface / bg-control) that fills as the conversation progresses — this stays empty for now.

Match the visual language from the earlier mockup: mostly neutral dark surfaces, color only on the orb and the alert banner.
```

## Prompt 5 — Backend: Groq integration and the assistant's system prompt

```
Architecture note — read before implementing: there are two separate paths, not one.
- Default shared key: always goes through the Express backend (below). This key must never be sent to the browser.
- User-supplied key (from Settings): must NEVER be sent to or touched by our backend at all. All three calls (chat, transcribe, speak) must be made directly from the browser straight to Groq's API using fetch(), with the user's key in the Authorization header. This is what makes the "your key never touches our server" privacy claim actually true rather than aspirational.
- Frontend logic (build this in Prompt 7): if calmspace_api_key is set in localStorage, call Groq directly from the browser and skip our backend entirely for that request. If it's not set, call our backend routes below, which use the default key.
- Add a fallback for the direct-browser path: if a direct call to Groq fails specifically due to a CORS/network-level error (not an auth or rate-limit error), show a clear inline message that the user's own key couldn't be used directly from the browser this session, rather than failing silently.

In the Express backend, add the DEFAULT-KEY-ONLY routes (used only when the user has not supplied their own key):

1. POST /api/chat — accepts { messages: [...], userContext: string }. Always uses the server's GROQ_API_KEY — this route is never passed a user key. Call Groq's chat completion endpoint with this exact system prompt (interpolate userContext into it if provided):

"You are the assistant inside Calm Space, a voice-based app that helps someone regain mental peace after an argument, conflict, or stressful moment. Your only job is to help the user process how they feel — not to resolve the argument, not to take sides, and not to help with unrelated tasks.

Follow this arc across the conversation, adapting pace to the user, not rushing:
1. Let them describe what happened and vent, without interruption or advice.
2. Reflect back what you heard so they feel understood, in your own words.
3. Once they've been heard, gently guide a short grounding moment — e.g. a breathing pause or a simple present-moment check-in.
4. Offer a gentle reframe or reflective question — never a lecture, never 'you shouldn't have done that.'
5. Close with a short, calm recap and, if it feels natural, one small intention for the next hour.

Hard rules:
- Never say who was 'right' or 'wrong' in the conflict they describe. Address only their emotional state.
- Never diagnose a mental health condition or use clinical labels for what they're feeling.
- Never give financial advice, write or debug code, or help with any task unrelated to emotional processing. If asked, gently decline and redirect: acknowledge the request, then ask how they're feeling about it instead.
- Do not be sycophantic — do not simply agree the other person was terrible. Stay warm but neutral.
- Keep responses conversational and voice-friendly: short paragraphs, no bullet lists, no markdown.

If user context was provided, take it into account: {{userContext}}"

2. POST /api/transcribe — accepts an audio blob (multipart), forwards it to Groq's Whisper endpoint using the server's default key only, returns { text }.

3. POST /api/speak — accepts { text }, forwards to Groq's PlayAI TTS endpoint using the server's default key only, returns the audio stream.

Add basic error handling on all three routes: missing/invalid default key returns a clear 401 with a short message, Groq rate-limit errors return 429 with a short message, network/timeout errors return 502. Do not leak the API key in any error response or log line.
```

## Prompt 6 — Crisis detection

```
Add a separate, independent safety check that runs on every user message BEFORE it reaches the main assistant reply in Prompt 5.

Add POST /api/safety-check — takes { message } and calls Groq with a short, separate system prompt whose only job is to classify whether the message indicates the user may be in crisis (suicidal ideation, intent of self-harm, intent of harm to others, or an acute emergency) — respond with strict JSON: { "risk": true|false }.

Wire this into the frontend flow: before sending a user message to /api/chat, first call /api/safety-check. If risk is true, skip the normal assistant reply entirely, call setOrbState('crisis'), and show the crisis banner from Prompt 4 with the resources text. Do not attempt to continue normal coaching in this state. Give the user a visible way to dismiss the banner and continue talking if they choose to, but do not auto-dismiss it.

Keep this check fast and lightweight — it should not noticeably slow down the normal conversation.
```

## Prompt 7 — Wire the frontend end-to-end

```
Connect everything built so far:

- Mic button: request microphone permission (handle denial with a clear inline message, not a silent failure); while recording, set orb state to "listening" and stream partial transcription into the text input live as captions using the browser's SpeechRecognition API for the live-caption effect, then on stop, send the final audio to /api/transcribe for the authoritative transcript and populate the input box with it — editable, not auto-sent.
- Send button / Enter key: run the safety check from Prompt 6 first; if clear, send the conversation so far to /api/chat, set orb state to "speaking" while awaiting the reply, add the reply to the message list, then send it to /api/speak and play the returned audio (skip this step entirely if the voice toggle from Settings is off), then return orb state to "idle".
- Show a subtle loading indicator any time we're waiting on transcription, chat reply, or speech generation — never leave the UI silent with no feedback.
- Read calmspace_api_key from localStorage on every request. If it's set: call Groq's chat/transcribe/speak endpoints directly from the browser via fetch(), using the user's key in the Authorization header, and do not call our backend at all for that request. If a direct call fails on what looks like a CORS or network-level error, show the fallback message from Prompt 5's architecture note. If calmspace_api_key is not set, call our backend routes (/api/chat, /api/transcribe, /api/speak) as normal, which use the default key.
- Read calmspace_context and pass it as userContext on the first chat call, whichever path is used.
- Handle errors from any endpoint with a short, calm inline message near the input (not a raw error dump) — e.g. "Couldn't reach the assistant, check your connection and try again."
```

## Prompt 8 — Session end and fresh-start guarantee

```
Add a visible "End session" button near the top bar. On click:
- Show a brief closing message from the assistant if the conversation had started (a short calm sign-off), then clear the in-memory message list and reset the orb to idle.
- Ensure no conversation content is written to localStorage or any backend store at any point — only the settings values from Prompt 3 persist locally.
- On every fresh page load (not just after clicking End session), the message list must start empty regardless of what happened in a previous tab session — verify there is no code path that rehydrates old messages from storage.
```

---

## Phase 2 — do not build yet

Once the above is working end-to-end, this is the next planned feature: let the user optionally save a session as an AI-generated summary, download it as a file, and re-upload it on a future visit to restore context — without the server ever storing conversation history itself. Flag me when you're ready to scope that out; it needs its own prompt sequence.
