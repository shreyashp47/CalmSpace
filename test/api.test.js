const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const systemPromptJs = fs.readFileSync(path.join(__dirname, "..", "public", "system-prompt.js"), "utf8");
const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

let fetchCalls = [];
let lastFetchImpl;

function bootDom(seedStorage = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      for (const [key, value] of Object.entries(seedStorage)) {
        window.localStorage.setItem(key, value);
      }
      window.fetch = (url, opts) => {
        fetchCalls.push({ url, opts });
        return lastFetchImpl(url, opts);
      };
    },
  });
  dom.window.eval(systemPromptJs);
  dom.window.eval(apiJs);
  dom.window.eval(appJs);
  return dom;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(["audio"], { type: "audio/mpeg" }),
    arrayBuffer: async () => new TextEncoder().encode("audio"),
  };
}

function networkFailureResponse() {
  return Promise.reject(new TypeError("Failed to fetch"));
}

before(() => {
  fetchCalls = [];
  lastFetchImpl = async () => jsonResponse({});
});

after(() => {});

test("server path: no user key -> requests go to our backend only", async () => {
  fetchCalls = [];
  const dom = bootDom({});
  await dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], "context here");

  assert.equal(fetchCalls.length, 1);
  const call = fetchCalls[0];
  assert.equal(call.url, "/api/chat");
  assert.equal(call.opts.headers.Authorization, undefined);
  const payload = JSON.parse(call.opts.body);
  assert.deepEqual(payload.messages, [{ role: "user", content: "hi" }]);
  assert.equal(payload.userContext, "context here");
});

test("direct path: user key set -> requests go straight to Groq, never to our server", async () => {
  fetchCalls = [];
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = async () => jsonResponse({ choices: [{ message: { content: "direct reply" } }] });

  const result = await dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], "be gentle");

  assert.equal(result.reply, "direct reply");
  assert.equal(fetchCalls.length, 1);
  const call = fetchCalls[0];
  assert.match(call.url, /^https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions$/);
  assert.equal(call.opts.headers.Authorization, "Bearer gsk_user_key");
  const payload = JSON.parse(call.opts.body);
  assert.equal(payload.messages[0].role, "system");
  assert.match(payload.messages[0].content, /You are the assistant inside Calm Space/);
  assert.match(payload.messages[0].content, /take it into account: be gentle/);
  assert.deepEqual(payload.messages[1], { role: "user", content: "hi" });
});

test("pathFor reflects the configured key", () => {
  const dom = bootDom({});
  assert.equal(dom.window.calmspace.api.pathFor(), "server");
  const dom2 = bootDom({ calmspace_api_key: "gsk_x" });
  assert.equal(dom2.window.calmspace.api.pathFor(), "direct");
});

test("direct path CORS/network failure surfaces the fallback message", async () => {
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = networkFailureResponse;

  await assert.rejects(
    () => dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], ""),
    (err) => {
      assert.equal(err.kind, "direct-cors");
      assert.match(err.message, /couldn't be used directly/);
      return true;
    }
  );
});

test("direct path auth error is NOT masked as CORS", async () => {
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = async () => jsonResponse({ error: "invalid key" }, 401);

  await assert.rejects(
    () => dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], ""),
    (err) => err.kind === "unauthorized"
  );
});

test("direct path rate limit surfaces rate-limited kind", async () => {
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = async () => jsonResponse({ error: "rate limited" }, 429);

  await assert.rejects(
    () => dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], ""),
    (err) => err.kind === "rate-limited"
  );
});

test("server path 502 surfaces unreachable kind", async () => {
  const dom = bootDom({});
  lastFetchImpl = async () => jsonResponse({ error: "bad gateway" }, 502);

  await assert.rejects(
    () => dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], ""),
    (err) => err.kind === "unreachable"
  );
});

test("server path network failure surfaces unreachable kind", async () => {
  const dom = bootDom({});
  lastFetchImpl = networkFailureResponse;

  await assert.rejects(
    () => dom.window.calmspace.api.chat([{ role: "user", content: "hi" }], ""),
    (err) => err.kind === "unreachable"
  );
});

test("direct transcribe sends audio to Groq with the user key", async () => {
  fetchCalls = [];
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = async () => jsonResponse({ text: "i feel anxious" });

  const result = await dom.window.calmspace.api.transcribe(
    new dom.window.Blob(["fake"], { type: "audio/webm" })
  );

  assert.deepEqual(result, { text: "i feel anxious" });
  assert.match(fetchCalls[0].url, /\/audio\/transcriptions$/);
  assert.equal(fetchCalls[0].opts.headers.Authorization, "Bearer gsk_user_key");
});

test("direct speak sends text to Groq with the user key", async () => {
  fetchCalls = [];
  const dom = bootDom({ calmspace_api_key: "gsk_user_key" });
  lastFetchImpl = async () => jsonResponse({}, 200);

  const audio = await dom.window.calmspace.api.speak("Take a breath");
  assert.ok(audio instanceof Blob);
  const call = fetchCalls[0];
  assert.match(call.url, /\/audio\/speech$/);
  assert.equal(call.opts.headers.Authorization, "Bearer gsk_user_key");
  const payload = JSON.parse(call.opts.body);
  assert.equal(payload.input, "Take a breath");
});

test("server speak request never carries an Authorization header", async () => {
  fetchCalls = [];
  const dom = bootDom({});
  lastFetchImpl = async () => jsonResponse({}, 200);

  await dom.window.calmspace.api.speak("Take a breath");
  assert.equal(fetchCalls[0].url, "/api/speak");
  assert.equal(fetchCalls[0].opts.headers.Authorization, undefined);
});