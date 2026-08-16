# Calm Space — Requirements document

## 1. Overview

**Problem**: After an argument or conflict, people get stuck ruminating on negative thoughts, which affects their focus and work. There's no quick, private way to process that in the moment.

**Solution**: A voice-first browser app. The user talks or types about what happened; an AI assistant listens, reflects it back, guides a short grounding exercise, and helps reframe the situation — aiming to leave the user calmer, not lectured at.

**Explicitly not**: therapy, a replacement for a licensed professional, or a crisis-response tool. It's a decompression aid for everyday stress.

---

## 2. Functional requirements

| # | Requirement | Status |
|---|---|---|
| 1 | Every site visit starts a brand-new chat session — no conversation history stored or reloaded between visits | MVP |
| 2 | First-ever visit shows a consent/disclaimer screen, then a settings screen, before the chat starts | MVP |
| 3 | A local-only flag (browser storage, not server-side) remembers that setup is complete, so these screens aren't repeated | MVP |
| 4 | Settings remain reachable afterward via a small icon, so the user can update them anytime | MVP |
| 5 | Input via typed text or voice. When speaking, live captions appear in the input box in real time; nothing auto-sends — the user reviews the text and sends manually | MVP |
| 6 | Assistant replies in text and voice (TTS). Voice has an on/off toggle in settings | MVP |
| 7 | A default free-tier API key (Groq) is built in and works out of the box. The user can optionally add their own key in settings for privacy — stored client-side only, never sent to the app's own server. **Architecture**: the default key is always used via the backend proxy; a user-supplied key calls Groq directly from the browser instead, bypassing the backend entirely, with a graceful fallback message if a direct browser call fails on CORS | MVP |
| 8 | Explicit "End session" action — not just closing the tab — that gives a short calm sign-off and clears the in-memory conversation | MVP |
| 9 | Save & summarize a session as a downloadable file; re-upload it later to restore context for a new session | Future / Phase 2 |

---

## 3. Conversation behavior & safety requirements

These govern how the AI is allowed to behave, not just the UI around it.

| # | Requirement | Status |
|---|---|---|
| 10 | Conversation follows a structured arc, not open freeform chat: **vent → reflect → grounding exercise → gentle reframe → close** | MVP |
| 11 | Crisis-language detection runs on every user message, independent of the main conversation logic. If triggered, the normal flow is interrupted and the user is shown crisis resources (e.g. call/text 988, call 911 for a medical emergency, contact someone they trust) instead of continued coaching | MVP |
| 12 | The assistant never takes a side on who was "right" in the conflict being described — it only ever addresses the user's emotional state | MVP |
| 13 | The assistant never assigns a clinical diagnosis or mental-health label to what the user describes | MVP |
| 14 | Topic scope is restricted to emotional/mental-peace support. Unrelated tasks (coding, financial advice, general trivia, etc.) are politely declined with a redirect back to how the user is feeling — this applies even when the *trigger* of their stress is work, money, or a technical problem; the emotional load stays in scope even when the task itself doesn't | MVP |
| 15 | A short disclaimer is shown before first use: this is not therapy, not a replacement for a licensed professional, and not equipped to handle emergencies | MVP |
| 16 | Data-handling notice: users are told not to share identifying personal details, and told plainly what is and isn't stored | Recommended |

---

## 4. Non-functional requirements

| # | Requirement | Status |
|---|---|---|
| 17 | Clear loading indicators during transcription, AI response generation, and speech synthesis — never silent dead air | MVP |
| 18 | Graceful error handling for: microphone permission denied, invalid or rate-limited API key, no internet connection — clear, calm inline messages, not raw error dumps | MVP |
| 19 | A way to stop or interrupt the assistant mid-speech, so voice output doesn't feel controlling | Recommended |
| 20 | Mobile responsiveness — people are likely to use this right after a stressful moment, often on a phone | Recommended |
| 21 | Basic abuse/rate-limit protection on the shared default API key, to prevent one user from draining the free quota for everyone | Recommended, becomes urgent once there's real traffic |
| 22 | Accessibility: screen reader support and keyboard-only navigation | Recommended |
| 23 | Multi-language support | Out of scope for v1 |

---

## 5. Design requirements

- **Theme**: dark-only for v1 ("Deep calm" palette) — see design tokens below. Light mode is deferred, but the CSS should be structured with theme-able variables from the start so it isn't a painful retrofit later.
- **Visual principle**: mostly neutral dark surfaces; color is reserved for meaning — the central "orb" state indicator and the crisis alert banner. No sharp contrast, no saturated or neon colors.
- **Crisis color rule**: the alert state must never use red — amber/warm-neutral only, to signal urgency without adding to the user's stress.

```
--bg-page: #0B1412
--bg-surface: #14201E
--bg-control: #1D2C29
--accent-primary: #6FBFA0   /* idle / listening */
--accent-speaking: #5FA3AE  /* AI speaking — visually distinct from listening */
--accent-alert: #D9A55B     /* crisis banner + orb — never red */
--text-primary: #E8ECEA
--text-secondary: #8FA39E
--icon-on-accent: #12201D
```

- **Core screens**: consent/disclaimer → settings → chat (with idle / listening / speaking / crisis states) → session end.

---

## 6. Open decisions (not yet finalized)

- Should voice interrupt/barge-in be built into v1, or added once the core flow is proven?
- Timing for adding light mode.
- Whether the shared free-tier key needs formal rate-limiting before public launch, or can wait until there's real traffic.
- Exact scope of Phase 2 (save/summarize/resume) — to be defined in its own requirements pass when the core is working.

---

## 7. Out of scope for v1

- Save/resume via downloadable session file (Phase 2)
- Light mode
- Multi-language support
- Analytics or feedback loops
- Cross-session memory of any kind (by design — every visit is a fresh start)
