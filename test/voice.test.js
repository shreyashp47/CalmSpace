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
let gumImpl = async () => ({ getTracks: () => [{ stop: () => {} }] });
let withSpeechRecognition = true;

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
      window.navigator.mediaDevices = { getUserMedia: () => gumImpl() };
      if (withSpeechRecognition) {
        window.SpeechRecognition = class {
          constructor() {
            window.__sr = this;
            this.continuous = false;
            this.interimResults = false;
          }
          start() {}
          stop() {}
        };
      }
      window.MediaRecorder = class {
        constructor(stream) {
          this.stream = stream;
          this.state = "inactive";
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable({
            data: new window.Blob(["audio-bytes"], { type: "audio/webm" }),
          });
          this.onstop();
        }
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
    if (url === "/api/transcribe") {
      return jsonRes({ text: "authoritative transcript" });
    }
    throw new Error("unexpected url " + url);
  };
  domBlob = require("node:buffer").Blob;
});

after(() => {});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

test("mic with no mic support shows calm inline message", async () => {
  const dom = bootDom(CHAT_FLAGS);
  delete dom.window.navigator.mediaDevices;
  dom.window.document.getElementById("btn-mic").click();
  await tick();
  const error = dom.window.document.getElementById("chat-error");
  assert.equal(error.classList.contains("hidden"), false);
  assert.match(error.textContent, /Microphone access isn't available/);
});

test("mic permission denial shows calm inline message", async () => {
  const dom = bootDom(CHAT_FLAGS);
  gumImpl = async () => {
    throw new Error("NotAllowedError");
  };
  dom.window.document.getElementById("btn-mic").click();
  await tick();
  const error = dom.window.document.getElementById("chat-error");
  assert.match(error.textContent, /Microphone access was denied/);
});

test("recording: orb listens, captions stream live, stop transcribes and pre-fills input", async () => {
  fetchCalls = [];
  gumImpl = async () => ({ getTracks: () => [{ stop: () => {} }] });
  const dom = bootDom(CHAT_FLAGS);
  const doc = dom.window.document;

  doc.getElementById("btn-mic").click();
  await tick();
  assert.match(doc.getElementById("orb").className, /orb-listening/);
  assert.equal(doc.getElementById("orb-status").textContent, "Listening...");

  dom.window.__sr.onresult({
    resultIndex: 0,
    results: [{ 0: { transcript: "live caption text" } }],
  });
  assert.equal(doc.getElementById("chat-input").value, "live caption text");

  doc.getElementById("btn-mic").click();
  await tick();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/transcribe");
  assert.equal(doc.getElementById("chat-input").value, "authoritative transcript");
  assert.match(doc.getElementById("orb").className, /orb-idle/);
});

test("recording without SpeechRecognition still transcribes, with a note", async () => {
  fetchCalls = [];
  withSpeechRecognition = false;
  gumImpl = async () => ({ getTracks: () => [{ stop: () => {} }] });
  const dom = bootDom(CHAT_FLAGS);
  const doc = dom.window.document;

  doc.getElementById("btn-mic").click();
  await tick();
  const error = doc.getElementById("chat-error");
  assert.match(error.textContent, /Live captions aren't supported/);

  doc.getElementById("btn-mic").click();
  await tick();
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/transcribe");
  withSpeechRecognition = true;
});