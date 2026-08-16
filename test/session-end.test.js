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
  lastFetchImpl = async (url) => {
    if (url === "/api/safety-check") {
      return jsonRes({ risk: false });
    }
    if (url === "/api/chat") {
      return jsonRes({ reply: "I'm here." });
    }
    if (url === "/api/speak") {
      return jsonRes({}, 200);
    }
    throw new Error("unexpected url " + url);
  };
  domBlob = require("node:buffer").Blob;
});

after(() => {});

function tick(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage(dom, text) {
  const doc = dom.window.document;
  doc.getElementById("chat-input").value = text;
  doc.getElementById("btn-send").click();
  await tick();
}

test("End session shows calm sign-off when a conversation started", async () => {
  const dom = bootDom(CHAT_FLAGS);
  await sendMessage(dom, "rough day");

  dom.window.document.getElementById("btn-end").click();
  const doc = dom.window.document;
  const signoff = doc.querySelector(".message-signoff");
  assert.ok(signoff, "sign-off bubble shown");
  assert.match(signoff.textContent, /take a breath/);
  assert.match(doc.getElementById("orb").className, /orb-idle/);

  await tick(3200);
  assert.equal(doc.querySelectorAll(".message").length, 0, "messages cleared after sign-off");
});

test("End session without a conversation just resets to idle", () => {
  const dom = bootDom(CHAT_FLAGS);
  const doc = dom.window.document;
  doc.getElementById("btn-end").click();
  assert.equal(doc.querySelector(".message-signoff"), null);
  assert.match(doc.getElementById("orb").className, /orb-idle/);
});

test("no conversation content ever reaches localStorage", async () => {
  const dom = bootDom(CHAT_FLAGS);
  await sendMessage(dom, "my private message about my boss");

  const keys = [];
  for (let i = 0; i < dom.window.localStorage.length; i++) {
    keys.push(dom.window.localStorage.key(i));
  }
  assert.deepEqual(
    keys.sort(),
    ["calmspace_consent_seen", "calmspace_setup_done"].sort(),
    "only flags stored — no context, no messages"
  );

  for (let i = 0; i < dom.window.localStorage.length; i++) {
    const value = dom.window.localStorage.getItem(dom.window.localStorage.key(i));
    assert.equal(value.includes("private message"), false, "message content leaked to storage");
  }
});

test("fresh page load always starts with an empty message list", async () => {
  const dom = bootDom(CHAT_FLAGS);
  await sendMessage(dom, "something stressful");

  const freshDom = bootDom(CHAT_FLAGS);
  assert.equal(freshDom.window.document.querySelectorAll(".message").length, 0);
  assert.match(freshDom.window.document.getElementById("orb-status").textContent, /Tap to speak/);
});