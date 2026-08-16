"use strict";

const express = require("express");
const path = require("path");

const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Calm Space server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;