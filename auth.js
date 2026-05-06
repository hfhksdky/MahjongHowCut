"use strict";

/**
 * Access gate for static pages.
 * SECURITY NOTE:
 * - This is client-side protection suitable for "casual sharing".
 * - For real security, put auth on server side.
 */
const ACCESS_CONFIG = {
  enabled: true,
  sharedPassword: "trashtalk",
  allowLocalHostByLogic: true,
  allowAccessHash: "",
  sessionMinutes: 240,
  sessionKey: "mahjong_poc_access_v1",
};

window.__MAHJONG_ACCESS_GRANTED__ = false;

initAccessGate().catch((err) => {
  renderFatalError(String(err instanceof Error ? err.message : err));
});

async function initAccessGate() {
  if (!ACCESS_CONFIG.enabled) {
    unlockAndBoot();
    return;
  }

  if (logicCheckPassed()) {
    writeSession();
    unlockAndBoot();
    return;
  }

  if (sessionStillValid()) {
    unlockAndBoot();
    return;
  }

  if (await queryHashPassed()) {
    writeSession();
    unlockAndBoot();
    return;
  }

  renderPasswordGate();
}

function logicCheckPassed() {
  if (!ACCESS_CONFIG.allowLocalHostByLogic) return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function readSession() {
  try {
    const raw = localStorage.getItem(ACCESS_CONFIG.sessionKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sessionStillValid() {
  const payload = readSession();
  if (!payload || typeof payload.expireAt !== "number") return false;
  return Date.now() < payload.expireAt;
}

function writeSession() {
  const minutes = Math.max(1, Number(ACCESS_CONFIG.sessionMinutes) || 1);
  const expireAt = Date.now() + minutes * 60 * 1000;
  try {
    localStorage.setItem(ACCESS_CONFIG.sessionKey, JSON.stringify({ expireAt }));
  } catch {
    // Ignore storage failures (private mode / strict browser policy).
  }
}

async function queryHashPassed() {
  const expected = String(ACCESS_CONFIG.allowAccessHash || "").trim().toLowerCase();
  if (!expected) return false;
  const token = new URLSearchParams(window.location.search).get("access");
  if (!token) return false;
  const digest = await sha256Hex(token);
  return digest === expected;
}

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function renderPasswordGate() {
  const root = document.createElement("div");
  root.className = "access-gate";
  root.innerHTML = `
    <section class="access-gate-card">
      <h2 class="access-gate-title">Restricted Access</h2>
      <p class="access-gate-desc">Enter shared password to continue.</p>
      <form class="access-gate-form" id="access-gate-form">
        <input class="access-gate-input" id="access-gate-input" type="password" autocomplete="off" placeholder="Shared password" />
        <button type="submit">Enter</button>
      </form>
      <p class="access-gate-error" id="access-gate-error"></p>
    </section>
  `;
  document.body.appendChild(root);

  const form = /** @type {HTMLFormElement|null} */ (document.getElementById("access-gate-form"));
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById("access-gate-input"));
  const errorEl = /** @type {HTMLElement|null} */ (document.getElementById("access-gate-error"));

  if (!form || !input || !errorEl) return;
  input.focus();

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const correct = String(ACCESS_CONFIG.sharedPassword || "");
    if (!correct || correct === "CHANGE_THIS_PASSWORD") {
      errorEl.textContent = "Owner has not configured password yet.";
      return;
    }
    if (input.value !== correct) {
      errorEl.textContent = "Wrong password.";
      input.value = "";
      input.focus();
      return;
    }
    writeSession();
    root.remove();
    unlockAndBoot();
  });
}

function renderFatalError(message) {
  document.body.innerHTML = `
    <div class="access-gate">
      <section class="access-gate-card">
        <h2 class="access-gate-title bad">Access Gate Error</h2>
        <p class="access-gate-error">${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unlockAndBoot() {
  window.__MAHJONG_ACCESS_GRANTED__ = true;
  document.body.classList.remove("preauth");
  const src = document.documentElement.getAttribute("data-protected-script");
  if (!src) return;
  const s = document.createElement("script");
  s.src = src;
  document.body.appendChild(s);
}
