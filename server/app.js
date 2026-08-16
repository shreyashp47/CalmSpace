"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const buildSystemPrompt = require("./systemPrompt");
const { MODELS, groqFetch } = require("./groq");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const MESSAGES = {
  missingKey: "Missing or invalid API key. Add GROQ_API_KEY to your .env.",
  rateLimited: "Rate limit reached — please wait a moment and try again.",
  unreachable: "Couldn't reach the AI service — check your connection and try again.",
};

const SAFETY_SYSTEM_PROMPT =
  "You are a safety classifier inside Calm Space, a mental-wellbeing app. Your only job is to decide whether the user's message indicates they may be in crisis: suicidal ideation, intent of self-harm, intent of harm to others, or an acute emergency. Respond with strict JSON only: {\"risk\": true} or {\"risk\": false}. Do not include any other text.";

function createApp({ groqFetchImpl = groqFetch, apiKey } = {}) {
  const app = express();
  app.use(express.json());

  function resolveKey() {
    return apiKey || process.env.GROQ_API_KEY;
  }

  function handleGroqError(res, err, status) {
    if (status === 429) {
      return res.status(429).json({ error: MESSAGES.rateLimited });
    }
    if (status === 401 || status === 403) {
      return res.status(401).json({ error: MESSAGES.missingKey });
    }
    if (err instanceof TypeError) {
      return res.status(502).json({ error: MESSAGES.unreachable });
    }
    return res.status(502).json({ error: MESSAGES.unreachable });
  }

  app.post("/api/chat", async (req, res) => {
    const key = resolveKey();
    if (!key) {
      return res.status(401).json({ error: MESSAGES.missingKey });
    }
    const { messages = [], userContext = "" } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const system = { role: "system", content: buildSystemPrompt(userContext) };
    const payload = {
      model: MODELS.chat,
      messages: [system, ...messages],
      temperature: 0.7,
    };

    try {
      const upstream = await groqFetchImpl("/chat/completions", {
        apiKey: key,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        return handleGroqError(res, null, upstream.status);
      }
      const data = await upstream.json();
      const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
      return res.json({ reply: content });
    } catch (err) {
      return handleGroqError(res, err, 0);
    }
  });

  app.post("/api/safety-check", async (req, res) => {
    const key = resolveKey();
    if (!key) {
      return res.status(401).json({ error: MESSAGES.missingKey });
    }
    const { message = "" } = req.body;
    if (!message.trim()) {
      return res.status(400).json({ error: "No message provided." });
    }

    const payload = {
      model: MODELS.chat,
      messages: [
        { role: "system", content: SAFETY_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    };

    try {
      const upstream = await groqFetchImpl("/chat/completions", {
        apiKey: key,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        return handleGroqError(res, null, upstream.status);
      }
      const data = await upstream.json();
      let parsed;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (err) {
        return res.status(502).json({ error: MESSAGES.unreachable });
      }
      if (typeof parsed.risk !== "boolean") {
        return res.status(502).json({ error: MESSAGES.unreachable });
      }
      return res.json({ risk: parsed.risk });
    } catch (err) {
      return handleGroqError(res, err, 0);
    }
  });

  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    const key = resolveKey();
    if (!key) {
      return res.status(401).json({ error: MESSAGES.missingKey });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }), req.file.originalname || "audio.webm");
    form.append("model", MODELS.transcribe);

    try {
      const upstream = await groqFetchImpl("/audio/transcriptions", {
        apiKey: key,
        body: form,
      });
      if (!upstream.ok) {
        return handleGroqError(res, null, upstream.status);
      }
      const data = await upstream.json();
      return res.json({ text: data.text || "" });
    } catch (err) {
      return handleGroqError(res, err, 0);
    }
  });

  app.post("/api/speak", async (req, res) => {
    const key = resolveKey();
    if (!key) {
      return res.status(401).json({ error: MESSAGES.missingKey });
    }
    const { text = "" } = req.body;
    if (!text.trim()) {
      return res.status(400).json({ error: "No text provided." });
    }

    const payload = {
      model: MODELS.speak,
      voice: MODELS.speakVoice,
      input: text,
    };

    try {
      const upstream = await groqFetchImpl("/audio/speech", {
        apiKey: key,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        return handleGroqError(res, null, upstream.status);
      }
      const audio = Buffer.from(await upstream.arrayBuffer());
      res.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
      return res.send(audio);
    } catch (err) {
      return handleGroqError(res, err, 0);
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.static(path.join(__dirname, "..", "public")));

  return app;
}

module.exports = { createApp, MESSAGES };