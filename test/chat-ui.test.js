const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

const CHAT_FLAGS = { calmspace_consent_seen: "true", calmspace_setup_done: "true" };

function bootDom(seedStorage = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      for (const [key, value] of Object.entries(seedStorage)) {
        window.localStorage.setItem(key, value);
      }
    },
  });
  dom.window.eval(appJs);
  return dom;
}

test("chat screen renders top bar, orb, and input row", () => {
  const dom = bootDom(CHAT_FLAGS);
  const doc = dom.window.document;
  assert.match(doc.body.textContent, /Calm space/);
  assert.ok(doc.getElementById("orb"));
  assert.ok(doc.getElementById("orb-status"));
  assert.ok(doc.getElementById("chat-input"));
  assert.ok(doc.getElementById("btn-mic"));
  assert.ok(doc.getElementById("btn-send"));
  assert.ok(doc.getElementById("btn-settings"));
  assert.equal(doc.getElementById("orb").className, "orb orb-idle");
  assert.equal(doc.getElementById("orb-status").textContent, "Tap to speak");
});

test("setOrbState('listening') shows listening status and pulse", () => {
  const dom = bootDom(CHAT_FLAGS);
  dom.window.calmspace.setOrbState("listening");
  const doc = dom.window.document;
  assert.equal(doc.getElementById("orb-status").textContent, "Listening...");
  assert.match(doc.getElementById("orb").className, /orb-listening/);
  assert.match(doc.getElementById("orb").className, /orb-pulse/);
});

test("setOrbState('speaking') is visually distinct from listening", () => {
  const dom = bootDom(CHAT_FLAGS);
  dom.window.calmspace.setOrbState("speaking");
  const doc = dom.window.document;
  assert.equal(doc.getElementById("orb-status").textContent, "Speaking...");
  assert.match(doc.getElementById("orb").className, /orb-speaking/);
  assert.equal(doc.getElementById("orb").className.includes("orb-listening"), false);
});

test("setOrbState('crisis') shows crisis status and banner, no pulse", () => {
  const dom = bootDom(CHAT_FLAGS);
  dom.window.calmspace.setOrbState("crisis");
  const doc = dom.window.document;
  assert.equal(doc.getElementById("orb-status").textContent, "We hear you. You are not alone.");
  assert.match(doc.getElementById("orb").className, /orb-crisis/);
  assert.equal(doc.getElementById("orb").className.includes("orb-pulse"), false);
  const banner = doc.getElementById("crisis-banner");
  assert.match(banner.textContent, /988/);
  assert.equal(banner.classList.contains("hidden"), false);
});

test("leaving crisis state hides the banner", () => {
  const dom = bootDom(CHAT_FLAGS);
  dom.window.calmspace.setOrbState("crisis");
  dom.window.calmspace.setOrbState("idle");
  assert.equal(
    dom.window.document.getElementById("crisis-banner").classList.contains("hidden"),
    true
  );
});

test("unknown orb state throws", () => {
  const dom = bootDom(CHAT_FLAGS);
  assert.throws(() => dom.window.calmspace.setOrbState("nope"), /Unknown orb state/);
});

test("gear icon opens settings and save returns to chat", () => {
  const dom = bootDom(CHAT_FLAGS);
  const doc = dom.window.document;
  doc.getElementById("btn-settings").click();
  assert.ok(doc.getElementById("settings-context"));
  doc.getElementById("settings-context").value = "from gear";
  doc.getElementById("settings-save").click();
  assert.equal(doc.getElementById("chat-input") !== null, true);
  assert.equal(dom.window.localStorage.getItem("calmspace_context"), "from gear");
});