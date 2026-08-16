"use strict";

const BASE_PROMPT = require("../public/system-prompt.js");

module.exports = function buildSystemPrompt(userContext) {
  if (userContext && userContext.trim()) {
    return `${BASE_PROMPT}\n\nIf user context was provided, take it into account: ${userContext}`;
  }
  return BASE_PROMPT;
};