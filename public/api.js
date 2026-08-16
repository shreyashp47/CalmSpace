(function () {
  "use strict";

  var GROQ_BASE = "https://api.groq.com/openai/v1";
  var MODELS = {
    chat: "llama-3.3-70b-versatile",
    transcribe: "whisper-large-v3-turbo",
    speak: "playai-tts",
    speakVoice: "Callisto-PlayAI",
  };

  function userKey() {
    return localStorage.getItem("calmspace_api_key") || null;
  }

  function pathFor() {
    return userKey() ? "direct" : "server";
  }

  function apiError(kind, message) {
    var err = new Error(message);
    err.kind = kind;
    return err;
  }

  async function request(url, key, opts) {
    var headers = Object.assign({}, opts.headers);
    if (key) {
      headers.Authorization = "Bearer " + key;
    }
    var res;
    try {
      res = await fetch(url, Object.assign({}, opts, { headers: headers }));
    } catch (err) {
      if (key) {
        throw apiError(
          "direct-cors",
          "Your own key couldn't be used directly from the browser this session."
        );
      }
      throw apiError(
        "unreachable",
        "Couldn't reach the assistant — check your connection and try again."
      );
    }
    if (res.ok) {
      return res;
    }
    if (res.status === 429) {
      throw apiError("rate-limited", "Rate limit reached — please wait a moment and try again.");
    }
    if (res.status === 401 || res.status === 403) {
      throw apiError("unauthorized", "Invalid API key.");
    }
    if (res.status >= 500) {
      throw apiError(
        "unreachable",
        "Couldn't reach the assistant — check your connection and try again."
      );
    }
    throw apiError("bad-request", "That request couldn't be processed.");
  }

  async function chat(messages, userContext) {
    var key = userKey();
    if (key) {
      var systemPrompt =
        (window.CALMSPACE_SYSTEM_PROMPT || "") +
        (userContext && userContext.trim()
          ? "\n\nIf user context was provided, take it into account: " + userContext
          : "");
      var res = await request(GROQ_BASE + "/chat/completions", key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODELS.chat,
          messages: [{ role: "system", content: systemPrompt }].concat(messages),
        }),
      });
      var data = await res.json();
      var content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
      return { reply: content };
    }
    var serverRes = await request("/api/chat", null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages, userContext: userContext || "" }),
    });
    return serverRes.json();
  }

  async function transcribe(audioBlob) {
    var form = new FormData();
    form.append("file", audioBlob, "audio.webm");
    form.append("model", MODELS.transcribe);

    var key = userKey();
    if (key) {
      var res = await request(GROQ_BASE + "/audio/transcriptions", key, {
        method: "POST",
        body: form,
      });
      var data = await res.json();
      return { text: data.text || "" };
    }
    var serverForm = new FormData();
    serverForm.append("audio", audioBlob, "audio.webm");
    var serverRes = await request("/api/transcribe", null, {
      method: "POST",
      body: serverForm,
    });
    return serverRes.json();
  }

  async function speak(text) {
    var key = userKey();
    if (key) {
      var res = await request(GROQ_BASE + "/audio/speech", key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODELS.speak, voice: MODELS.speakVoice, input: text }),
      });
      return res.blob();
    }
    var serverRes = await request("/api/speak", null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });
    return serverRes.blob();
  }

  window.calmspace = window.calmspace || {};
  window.calmspace.api = { chat: chat, transcribe: transcribe, speak: speak, pathFor: pathFor };
})();