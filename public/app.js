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

  function render(html) {
    app.innerHTML = html;
  }

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
      showSettings();
    });
  }

  function showSettings() {
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

  function showChat() {
    render(
      '<div class="screen">' +
        '<div class="card">' +
        '<h2 class="card-title">Calm Space</h2>' +
        '<p class="card-text">Chat screen — coming next.</p>' +
        "</div>" +
        "</div>"
    );
  }

  function boot() {
    if (localStorage.getItem(STORAGE_KEYS.consentSeen) !== "true") {
      showConsent();
    } else if (localStorage.getItem(STORAGE_KEYS.setupDone) !== "true") {
      showSettings();
    } else {
      showChat();
    }
  }

  boot();
})();