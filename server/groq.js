const GROQ_BASE = "https://api.groq.com/openai/v1";

const MODELS = {
  chat: "llama-3.3-70b-versatile",
  transcribe: "whisper-large-v3-turbo",
  speak: "playai-tts",
  speakVoice: "Callisto-PlayAI",
};

async function groqFetch(path, { method = "POST", apiKey, headers = {}, body } = {}) {
  const res = await fetch(`${GROQ_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body,
  });
  return res;
}

module.exports = { GROQ_BASE, MODELS, groqFetch };