const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const buildSystemPrompt = require("../server/systemPrompt.js");
const { createApp, MESSAGES } = require("../server/app.js");

const KEY = "gsk_test_key_123";

let server;
let baseUrl;
let calls = [];

function mockGroq({ status = 200, json = {}, contentType = "audio/mpeg", throws = false, body = Buffer.from("audio-bytes") } = {}) {
  return async (url, opts) => {
    calls.push({ url, opts });
    if (throws) {
      throw new TypeError("fetch failed");
    }
    const ok = status >= 200 && status < 300;
    return {
      ok,
      status,
      headers: { get: (name) => (name === "content-type" ? contentType : null) },
      json: async () => json,
      arrayBuffer: async () => body,
    };
  };
}

before(async () => {
  server = createApp({ groqFetchImpl: mockGroq(), apiKey: KEY }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("system prompt follows the structured arc with hard rules", () => {
  const prompt = buildSystemPrompt("");
  assert.match(prompt, /vent/);
  assert.match(prompt, /Reflect back what you heard/);
  assert.match(prompt, /grounding moment/);
  assert.match(prompt, /gentle reframe/);
  assert.match(prompt, /Never say who was 'right' or 'wrong'/);
  assert.match(prompt, /Never diagnose/);
  assert.match(prompt, /voice-friendly: short paragraphs, no bullet lists/);
});

test("system prompt interpolates user context", () => {
  const prompt = buildSystemPrompt("I prefer short replies");
  assert.match(prompt, /take it into account: I prefer short replies/);
});

test("POST /api/chat forwards to Groq with system prompt and returns reply", async () => {
  calls = [];
  const app = createApp({
    groqFetchImpl: mockGroq({ json: { choices: [{ message: { content: "mock-reply" } }] } }),
    apiKey: KEY,
  }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "I feel awful" }] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.reply, "mock-reply");
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.url, "/chat/completions");
  assert.equal(call.opts.apiKey, KEY);
  assert.equal(call.opts.headers["Content-Type"], "application/json");
  assert.equal(call.opts.body.includes(KEY), false, "key must not leak into request body");
  const payload = JSON.parse(call.opts.body);
  assert.equal(payload.model, "llama-3.3-70b-versatile");
  assert.equal(payload.messages[0].role, "system");
  assert.match(payload.messages[0].content, /You are the assistant inside Calm Space/);
  assert.deepEqual(payload.messages[1], { role: "user", content: "I feel awful" });
});

test("chat passes userContext into the system prompt", async () => {
  calls = [];
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
      userContext: "be extra gentle",
    }),
  });
  assert.equal(res.status, 200);
  const payload = JSON.parse(calls[0].opts.body);
  assert.match(payload.messages[0].content, /take it into account: be extra gentle/);
});

test("chat returns 401 when no key is configured", async () => {
  const noKeyApp = createApp({ groqFetchImpl: mockGroq() }).listen(0);
  await new Promise((resolve) => noKeyApp.once("listening", resolve));
  const url = `http://127.0.0.1:${noKeyApp.address().port}`;
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: MESSAGES.missingKey });
  } finally {
    await new Promise((resolve) => noKeyApp.close(resolve));
  }
});

test("chat maps Groq rate limit to calm 429", async () => {
  const app = createApp({ groqFetchImpl: mockGroq({ status: 429 }), apiKey: KEY }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: MESSAGES.rateLimited });
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test("chat maps Groq auth failure to 401 without leaking key", async () => {
  const app = createApp({ groqFetchImpl: mockGroq({ status: 401 }), apiKey: KEY }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.equal(text.includes(KEY), false);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test("chat maps network failure to 502", async () => {
  const app = createApp({ groqFetchImpl: mockGroq({ throws: true }), apiKey: KEY }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: MESSAGES.unreachable });
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test("POST /api/transcribe forwards audio to Whisper and returns text", async () => {
  calls = [];
  const app = createApp({ groqFetchImpl: mockGroq({ json: { text: "i feel anxious" } }), apiKey: KEY }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  try {
    const form = new FormData();
    form.append("audio", new Blob([Buffer.from("fake-audio")], { type: "audio/webm" }), "clip.webm");
    const res = await fetch(`${url}/api/transcribe`, { method: "POST", body: form });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: "i feel anxious" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/audio/transcriptions");
    assert.equal(calls[0].opts.apiKey, KEY);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test("transcribe without audio file returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/transcribe`, { method: "POST" });
  assert.equal(res.status, 400);
});

test("POST /api/speak returns audio stream", async () => {
  calls = [];
  const res = await fetch(`${baseUrl}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Take a breath" }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), Buffer.from("audio-bytes"));
  assert.equal(calls[0].url, "/audio/speech");
  assert.equal(calls[0].opts.apiKey, KEY);
  const payload = JSON.parse(calls[0].opts.body);
  assert.equal(payload.input, "Take a breath");
});

test("speak without text returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "  " }),
  });
  assert.equal(res.status, 400);
});