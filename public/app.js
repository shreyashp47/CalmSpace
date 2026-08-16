(function () {
  "use strict";

  var STORAGE_KEYS = {
    consentSeen: "calmspace_consent_seen",
    setupDone: "calmspace_setup_done",
    context: "calmspace_context",
    voiceEnabled: "calmspace_voice_enabled",
    apiKey: "calmspace_api_key",
  };

  var app = document.getElementById("app");

  var state = {
    messages: [],
    contextSent: false,
    busy: false,
  };

  var ERROR_MESSAGES = {
    "direct-cors":
      "Your own key couldn't be used directly from the browser this session. Check it in settings, or clear it to use the shared key.",
    "rate-limited": "Rate limit reached — please wait a moment and try again.",
    unauthorized: "The API key was rejected. Check it in settings.",
    unreachable: "Couldn't reach the assistant — check your connection and try again.",
    "bad-request": "That request couldn't be processed — try again.",
    "mic-denied": "Microphone access was denied. Enable it in your browser settings and try again.",
    "mic-unavailable":
      "Microphone access isn't available in this browser. You can still type.",
    "captions-unavailable":
      "Live captions aren't supported in this browser — recording without them.",
  };

  var voice = {
    recorder: null,
    recognition: null,
    chunks: [],
    stream: null,
    listening: false,
  };

  var ORB_STATES = {
    idle: {
      status: "Tap to speak",
      label: "mic",
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" fill="currentColor"/></svg>',
    },
    listening: {
      status: "Listening...",
      label: "mic",
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" fill="currentColor"/></svg>',
      pulse: true,
    },
    speaking: {
      status: "Speaking...",
      label: "volume",
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>',
      pulse: true,
    },
    crisis: {
      status: "We hear you. You are not alone.",
      label: "heart",
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.2C.5 8.6 2.6 5 6 5c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.4 0 5.5 3.6 4 6.8C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>',
      pulse: false,
    },
  };

  function render(html) {
    app.innerHTML = html;
  }

  /* ---------- Consent ---------- */

  function showConsent() {
    render(
      '<div class="screen">' +
        '<div class="card">' +
        '<h1 class="card-title">Calm Space</h1>' +
        '<p class="card-text">' +
        "This app helps you process stress after an argument or a hard moment. " +
        "Talk or type about what happened, and we'll walk through it together." +
        "</p>" +
        '<p class="card-text">' +
        "Calm Space is <strong>not therapy</strong>. It is not a replacement for a " +
        "licensed mental health professional, and it is not equipped to handle emergencies." +
        "</p>" +
        '<p class="card-text card-muted">' +
        "Please don't share identifying personal details such as your full name or address. " +
        "Nothing you type is stored on our server beyond the current session." +
        "</p>" +
        '<button id="consent-continue" class="btn btn-primary" type="button">' +
        "I understand, continue" +
        "</button>" +
        "</div>" +
        "</div>"
    );
    document.getElementById("consent-continue").addEventListener("click", function () {
      localStorage.setItem(STORAGE_KEYS.consentSeen, "true");
      showSettings(false);
    });
  }

  /* ---------- Settings ---------- */

  function showSettings(fromGear) {
    render(
      '<div class="screen">' +
        '<div class="card">' +
        '<h2 class="card-title">Before we start</h2>' +
        '<label class="field-label" for="settings-context">' +
        "Anything you'd like the assistant to know before we start?" +
        "</label>" +
        '<textarea id="settings-context" class="field field-textarea" placeholder="Optional — e.g. what helps you when you are stressed"></textarea>' +
        '<div class="field-row">' +
        '<label class="field-label" for="settings-voice">Speak replies out loud</label>' +
        '<input type="checkbox" id="settings-voice" class="switch" checked>' +
        "</div>" +
        '<label class="field-label" for="settings-api-key">Use your own Groq API key (optional, for privacy)</label>' +
        '<input type="password" id="settings-api-key" class="field" placeholder="gsk_...">' +
        '<p class="field-hint">' +
        "If left blank, we'll use a shared free key. Your own key is stored only in " +
        "your browser and is never sent to our server." +
        "</p>" +
        '<button id="settings-save" class="btn btn-primary" type="button">Save and continue</button>' +
        "</div>" +
        "</div>"
    );

    var savedContext = localStorage.getItem(STORAGE_KEYS.context) || "";
    var voiceEnabled = localStorage.getItem(STORAGE_KEYS.voiceEnabled) !== "false";
    var savedKey = localStorage.getItem(STORAGE_KEYS.apiKey) || "";

    document.getElementById("settings-context").value = savedContext;
    document.getElementById("settings-voice").checked = voiceEnabled;
    document.getElementById("settings-api-key").value = savedKey;

    document.getElementById("settings-save").addEventListener("click", function () {
      localStorage.setItem(STORAGE_KEYS.context, document.getElementById("settings-context").value);
      localStorage.setItem(STORAGE_KEYS.voiceEnabled, document.getElementById("settings-voice").checked ? "true" : "false");
      localStorage.setItem(STORAGE_KEYS.apiKey, document.getElementById("settings-api-key").value);
      localStorage.setItem(STORAGE_KEYS.setupDone, "true");
      showChat();
    });
  }

  /* ---------- Chat ---------- */

  function setOrbState(state) {
    if (!ORB_STATES[state]) {
      throw new Error("Unknown orb state: " + state);
    }
    var config = ORB_STATES[state];
    var orb = document.getElementById("orb");
    var status = document.getElementById("orb-status");
    var banner = document.getElementById("crisis-banner");
    if (!orb || !status) {
      return;
    }

    orb.className = "orb orb-" + state + (config.pulse ? " orb-pulse" : "");
    document.getElementById("orb-icon").innerHTML = config.svg;
    status.textContent = config.status;
    if (banner) {
      banner.classList.toggle("hidden", state !== "crisis");
    }
  }

  function showChat() {
    render(
      '<div class="chat">' +
        '<div id="crisis-banner" class="crisis-banner hidden" role="alert">' +
        '<span>Feeling unsafe? Call or text 988, or reach out to someone you trust.</span>' +
        '<button id="crisis-dismiss" class="crisis-dismiss" type="button" aria-label="Dismiss crisis message">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z" fill="currentColor"/></svg>' +
        "</button>" +
        "</div>" +
        '<header class="topbar">' +
        '<span class="brand">Calm space</span>' +
        '<button id="btn-settings" class="icon-btn" type="button" aria-label="Settings">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.7l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.7 7.7 0 0 0-1.7-1L14.4 2a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.7L6.5 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.7l2 3.4c.1.2.4.3.6.2l2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.2 0 .4-.2.5-.4l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.7L19.4 13z" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>' +
        "</button>" +
        "</header>" +
        '<main class="chat-main">' +
        '<div id="orb" class="orb" role="status">' +
        '<span id="orb-icon">' +
        ORB_STATES.idle.svg +
        "</span>" +
        "</div>" +
        '<p id="orb-status" class="orb-status" aria-live="polite">Tap to speak</p>' +
        '<div id="messages" class="messages" aria-live="polite"></div>' +
        "</main>" +
        '<footer class="input-row">' +
        '<input id="chat-input" class="field chat-input" type="text" placeholder="Type how you\'re feeling..." aria-label="How are you feeling?">' +
        '<button id="btn-mic" class="icon-btn orb-btn" type="button" aria-label="Speak">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" fill="currentColor"/></svg>' +
        "</button>" +
        '<button id="btn-send" class="btn btn-primary btn-send" type="button">Send</button>' +
        "</footer>" +
        '<p id="chat-error" class="chat-error hidden" aria-live="polite"></p>' +
        '<p id="chat-busy" class="chat-busy hidden" aria-live="polite">Thinking…</p>' +
        "</div>"
    );

    document.getElementById("btn-settings").addEventListener("click", function () {
      showSettings(true);
    });
    document.getElementById("btn-send").addEventListener("click", function () {
      handleSend();
    });
    document.getElementById("btn-mic").addEventListener("click", function () {
      handleMic();
    });
    document.getElementById("chat-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        handleSend();
      }
    });
    document.getElementById("crisis-dismiss").addEventListener("click", function () {
      setOrbState("idle");
    });

    setOrbState("idle");
  }

  function addMessage(role, text) {
    state.messages.push({ role: role, content: text });
    var messages = document.getElementById("messages");
    var bubble = document.createElement("div");
    bubble.className = "message message-" + role;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function showInlineError(kind) {
    var el = document.getElementById("chat-error");
    el.textContent = ERROR_MESSAGES[kind] || "Something went wrong — please try again.";
    el.classList.remove("hidden");
  }

  function clearInlineError() {
    var el = document.getElementById("chat-error");
    if (el) {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function setBusy(busy) {
    state.busy = busy;
    var el = document.getElementById("chat-busy");
    if (el) {
      el.classList.toggle("hidden", !busy);
    }
  }

  function playAudio(blob) {
    var AudioCtor = window.Audio || window.webkitAudio;
    if (!AudioCtor) {
      return;
    }
    var url = URL.createObjectURL(blob);
    var audio = new AudioCtor(url);
    audio.onended = function () {
      URL.revokeObjectURL(url);
    };
    audio.play().catch(function () {
      URL.revokeObjectURL(url);
    });
  }

  function handleMic() {
    if (voice.listening) {
      stopVoice();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showInlineError("mic-unavailable");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        voice.stream = stream;
        voice.chunks = [];
        setOrbState("listening");
        try {
          voice.recorder = new MediaRecorder(stream);
          voice.recorder.ondataavailable = function (event) {
            if (event.data.size) {
              voice.chunks.push(event.data);
            }
          };
          voice.recorder.onstop = function () {
            finishVoice();
          };
          voice.recorder.start();
          startCaptions();
          voice.listening = true;
        } catch (err) {
          showInlineError("mic-unavailable");
          setOrbState("idle");
          voice.stream.getTracks().forEach(function (track) {
            track.stop();
          });
        }
      })
      .catch(function () {
        showInlineError("mic-denied");
      });
  }

  function startCaptions() {
    var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      showInlineError("captions-unavailable");
      return;
    }
    var recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = function (event) {
      var transcript = "";
      for (var i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      document.getElementById("chat-input").value = transcript;
    };
    recognition.onerror = function (event) {
      if (event.error === "not-allowed") {
        showInlineError("mic-denied");
      }
    };
    recognition.onend = function () {
      if (voice.listening) {
        try {
          recognition.start();
        } catch (err) {
          /* recognition already active */
        }
      }
    };
    voice.recognition = recognition;
    recognition.start();
  }

  function stopVoice() {
    voice.listening = false;
    if (voice.recognition) {
      voice.recognition.stop();
    }
    if (voice.recorder && voice.recorder.state !== "inactive") {
      voice.recorder.stop();
    }
  }

  async function finishVoice() {
    var blob = new Blob(voice.chunks, { type: "audio/webm" });
    voice.stream.getTracks().forEach(function (track) {
      track.stop();
    });
    setBusy(true);
    try {
      var result = await window.calmspace.api.transcribe(blob);
      document.getElementById("chat-input").value = result.text;
    } catch (err) {
      showInlineError(err.kind || "unknown");
    } finally {
      setBusy(false);
      setOrbState("idle");
    }
  }

  async function handleSend() {
    var input = document.getElementById("chat-input");
    var text = input.value.trim();
    if (!text || state.busy) {
      return;
    }
    input.value = "";
    clearInlineError();
    addMessage("user", text);
    setBusy(true);
    try {
      var userContext = "";
      if (!state.contextSent) {
        userContext = localStorage.getItem(STORAGE_KEYS.context) || "";
        state.contextSent = true;
      }

      var safety = await window.calmspace.api.safetyCheck(text);
      if (safety.risk) {
        setOrbState("crisis");
        return;
      }

      setOrbState("speaking");
      var reply = await window.calmspace.api.chat(state.messages, userContext);
      addMessage("assistant", reply.reply);

      var voiceEnabled = localStorage.getItem(STORAGE_KEYS.voiceEnabled) !== "false";
      if (voiceEnabled) {
        var audio = await window.calmspace.api.speak(reply.reply);
        playAudio(audio);
      }
      setOrbState("idle");
    } catch (err) {
      setOrbState("idle");
      showInlineError(err.kind || "unknown");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Boot ---------- */

  function boot() {
    if (localStorage.getItem(STORAGE_KEYS.consentSeen) !== "true") {
      showConsent();
    } else if (localStorage.getItem(STORAGE_KEYS.setupDone) !== "true") {
      showSettings(false);
    } else {
      showChat();
    }
  }

  window.calmspace = Object.assign(window.calmspace || {}, {
    setOrbState: setOrbState,
    STORAGE_KEYS: STORAGE_KEYS,
  });

  boot();
})();