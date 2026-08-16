const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../server/index.js");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("GET /api/health returns ok", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("serves the frontend at /", async () => {
  const res = await fetch(baseUrl);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Calm Space/);
});

test("serves static assets (styles.css)", async () => {
  const res = await fetch(`${baseUrl}/styles.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/css/);
});