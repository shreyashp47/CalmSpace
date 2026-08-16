const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

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

test("first-ever visit shows the consent screen", () => {
  const dom = bootDom();
  const doc = dom.window.document;
  assert.ok(doc.getElementById("consent-continue"), "continue button present");
  assert.match(doc.body.textContent, /not therapy/);
  assert.match(doc.body.textContent, /identifying personal details/);
});

test("continue sets the flag and moves to settings", () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById("consent-continue").click();
  assert.equal(dom.window.localStorage.getItem("calmspace_consent_seen"), "true");
  assert.match(doc.body.textContent, /Before we start/);
});

test("returning visit with consent flag skips consent screen", () => {
  const dom = bootDom({ calmspace_consent_seen: "true" });
  const doc = dom.window.document;
  assert.equal(doc.getElementById("consent-continue"), null);
  assert.match(doc.body.textContent, /Before we start/);
});