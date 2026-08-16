const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const systemPromptJs = fs.readFileSync(path.join(__dirname, "..", "public", "system-prompt.js"), "utf8");
const apiJs = fs.readFileSync(path.join(__dirname, "..", "public", "api.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

const CHAT_FLAGS = { calmspace_consent_seen: "true", calmspace_setup_done: "true" };

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

function routingMock({ risk = false, reply = "take a breath", speakFailure = false } = {}) {
  return async (url, opts) => {
    if (url === "/api/safety-check") {
      return jsonRes({ risk });
    }
    if (url === "/api/chat") {
      return jsonRes({ reply });
    }
    if (url === "/api/speak") {
      return jsonRes({}, 200);
    }
    if (url.startsWith("https://api.groq.com")) {
      return jsonRes({ choices: [{ message: { content: reply } }] });
    }
    throw new Error("unexpected url " + url);
  };
}

function jsonRes(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new domBlob(["audio"], { type: "audio/mpeg" }),
  };
}

let domBlob;

before(() => {
  fetchCalls = [];
  lastFetchImpl = routingMock();
  domBlob = require("node:buffer").Blob;
});

after(() => {});

function typeAndSend(dom, text) {
  const doc = dom.window.document;
  const input = doc.getElementById("chat-input");
  input.value = text;
  doc.getElementById("btn-send").click();
}

test("send with risk=false: safety check, chat reply, TTS, orb returns to idle", async () => {
  fetchCalls = [];
  const dom = bootDom(CHAT_FLAGS);
  lastFetchImpl = routingMock({ reply: "I hear you. Let's breathe together." });

  typeAndSend(dom, "work was awful today");

  await new Promise((resolve) => setTimeout(resolve, 50));
  const doc = dom.window.document;
  assert.equal(doc.getElementById("orb").className.includes("orb-idle"), true);
  const urls = fetchCalls.map((c) => c.url);
  assert.deepEqual(urls, ["/api/safety-check", "/api/chat", "/api/speak"]);
  const userBubble = doc.querySelector(".message-user");
  const assistantBubble = doc.querySelector(".message-assistant");
  assert.equal(userBubble.textContent, "work was awful today");
  assert.equal(assistantBubble.textContent, "I hear you. Let's breathe together.");
});

test("userContext is passed only on the first chat call", async () => {
  fetchCalls = [];
  const dom = bootDom(Object.assign({}, CHAT_FLAGS, { calmspace_context: "be extra gentle" }));
  lastFetchImpl = routingMock();

  typeAndSend(dom, "first message");
  await new Promise((resolve) => setTimeout(resolve, 50));
  typeAndSend(dom, "second message");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const chatCalls = fetchCalls.filter((c) => c.url === "/api/chat");
  assert.equal(chatCalls.length, 2);
  assert.equal(JSON.parse(chatCalls[0].opts.body).userContext, "be extra gentle");
  assert.equal(JSON.parse(chatCalls[1].opts.body).userContext, "");
});

test("voice toggle off skips TTS but still shows the reply", async () => {
  fetchCalls = [];
  const dom = bootDom(Object.assign({}, CHAT_FLAGS, { calmspace_voice_enabled: "false" }));
  lastFetchImpl = routingMock({ reply: "ok" });

  typeAndSend(dom, "hello");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const urls = fetchCalls.map((c) => c.url);
  assert.deepEqual(urls, ["/api/safety-check", "/api/chat"]);
  assert.ok(dom.window.document.querySelector(".message-assistant"));
});

test("crisis message: skips the assistant reply entirely, shows crisis state", async () => {
  fetchCalls = [];
  const dom = bootDom(CHAT_FLAGS);
  lastFetchImpl = routingMock({ risk: true });

  typeAndSend(dom, "i want to end it all");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const doc = dom.window.document;
  const urls = fetchCalls.map((c) => c.url);
  assert.deepEqual(urls, ["/api/safety-check"], "no chat or TTS calls after risk");
  assert.match(doc.getElementById("orb").className, /orb-crisis/);
  assert.equal(doc.getElementById("orb-status").textContent, "We hear you. You are not alone.");
  assert.equal(doc.getElementById("crisis-banner").classList.contains("hidden"), false);
  assert.match(doc.getElementById("crisis-banner").textContent, /988/);
  assert.equal(doc.querySelector(".message-assistant"), null);
});

test("crisis banner is user-dismissible and does not auto-dismiss", async () => {
  const dom = bootDom(CHAT_FLAGS);
  lastFetchImpl = routingMock({ risk: true });

  typeAndSend(dom, "i want to end it all");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const doc = dom.window.document;
  const banner = doc.getElementById("crisis-banner");
  assert.equal(banner.classList.contains("hidden"), false);
  doc.getElementById("crisis-dismiss").click();
  assert.equal(banner.classList.contains("hidden"), true);
  assert.match(doc.getElementById("orb").className, /orb-idle/);
});

test("after dismissing crisis, further messages can be sent", async () => {
  fetchCalls = [];
  const dom = bootDom(CHAT_FLAGS);
  let risk = true;
  lastFetchImpl = async (url, opts) => {
    if (url === "/api/safety-check") {
      return jsonRes({ risk });
    }
    if (url === "/api/chat") {
      return jsonRes({ reply: "still here for you" });
    }
    if (url === "/api/speak") {
      return jsonRes({}, 200);
    }
    throw new Error("unexpected url " + url);
  };

  typeAndSend(dom, "i want to end it all");
  await new Promise((resolve) => setTimeout(resolve, 50));
  dom.window.document.getElementById("crisis-dismiss").click();
  risk = false;

  typeAndSend(dom, "im calmer now");
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(dom.window.document.querySelector(".message-assistant"));
});

test("chat failure shows calm inline error and resets orb", async () => {
  fetchCalls = [];
  const dom = bootDom(CHAT_FLAGS);
  lastFetchImpl = async (url) => {
    if (url === "/api/safety-check") {
      return jsonRes({ risk: false });
    }
    if (url === "/api/chat") {
      throw new TypeError("fetch failed");
    }
    throw new Error("unexpected url " + url);
  };

  typeAndSend(dom, "hello there");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const doc = dom.window.document;
  const error = doc.getElementById("chat-error");
  assert.equal(error.classList.contains("hidden"), false);
  assert.match(error.textContent, /connection/i);
  assert.match(doc.getElementById("orb").className, /orb-idle/);
});

test("empty input does not send", async () => {
  fetchCalls = [];
  const dom = bootDom(CHAT_FLAGS);
  typeAndSend(dom, "   ");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fetchCalls.length, 0);
});