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
        '<p class="card-text">Settings screen — coming next.</p>' +
        "</div>" +
        "</div>"
    );
  }

  function boot() {
    if (localStorage.getItem(STORAGE_KEYS.consentSeen) !== "true") {
      showConsent();
    } else if (localStorage.getItem(STORAGE_KEYS.setupDone) !== "true") {
      showSettings();
    }
  }

  boot();
})();