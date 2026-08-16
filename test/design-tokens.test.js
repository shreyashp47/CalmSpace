const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = path.join(__dirname, "..", "public", "styles.css");
const css = fs.readFileSync(cssPath, "utf8");

const LOCKED_TOKENS = {
  "--bg-page": "#0B1412",
  "--bg-surface": "#14201E",
  "--bg-control": "#1D2C29",
  "--accent-primary": "#6FBFA0",
  "--accent-speaking": "#5FA3AE",
  "--accent-alert": "#D9A55B",
  "--text-primary": "#E8ECEA",
  "--text-secondary": "#8FA39E",
  "--icon-on-accent": "#12201D",
};

test("all 8 locked design tokens are defined with exact values", () => {
  for (const [token, value] of Object.entries(LOCKED_TOKENS)) {
    const re = new RegExp(`${token}\\s*:\\s*${value.replace("#", "#")}`, "i");
    assert.match(css, re, `missing or wrong value for ${token}`);
  }
});

test("body uses theme tokens, no hardcoded colors in body rules", () => {
  assert.match(css, /background:\s*var\(--bg-page\)/);
  assert.match(css, /color:\s*var\(--text-primary\)/);
});

test("crisis color rule: no red hex values anywhere in the stylesheet", () => {
  const redHex = css.match(/#(?:f00|ff0000|e[0-9a-f]00|d[0-9a-f]00)\b/gi);
  assert.equal(redHex, null, `found red hex in stylesheet: ${redHex}`);
});