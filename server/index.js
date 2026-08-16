require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Calm Space server listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, getServer: () => server, closeServer: () => server && server.close() };