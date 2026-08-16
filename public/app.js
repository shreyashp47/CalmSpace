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
        "Feeling unsafe? Call or text 988, or reach out to someone you trust." +
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
        "</div>"
    );

    document.getElementById("btn-settings").addEventListener("click", function () {
      showSettings(true);
    });

    setOrbState("idle");
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