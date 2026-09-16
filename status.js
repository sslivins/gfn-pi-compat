(() => {
  "use strict";

  const STATUS = "gfn-pi-compat:status:v1";
  const REQUEST = "gfn-pi-compat:request:v1";
  const reasons = new Set([
    "waiting-for-module", "module-timeout", "factory-threw",
    "export-mismatch", "eligibility-override-only", "override-threw",
    "factory-shape-mismatch", "factory-not-writable", "factory-hook-failed",
    "chunk-array-mismatch", "push-property-mismatch", "push-not-callable",
    "chunk-hook-failed", "global-property-mismatch", "global-hook-failed"
  ]);
  let diagnostic = { state: "unknown", reason: "no-main-world-status" };
  let warning;
  let warned = false;

  function showWarning() {
    if (warned || !["incompatible", "error", "unknown"].includes(diagnostic.state)) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", showWarning, { once: true });
      return;
    }
    warned = true;
    warning = document.createElement("div");
    warning.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:340px;";
    const root = warning.attachShadow({ mode: "closed" });
    const box = document.createElement("div");
    box.style.cssText = "background:#202124;color:#fff;padding:12px;border:1px solid #aaa;border-radius:8px;font:14px/1.4 system-ui;box-shadow:0 2px 8px #0008;";
    box.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = "GFN Pi Compat: HEVC eligibility override not confirmed. Check the extension popup. Normal GFN capability checks remain in place. ";
    const close = document.createElement("button");
    close.textContent = "Dismiss";
    close.addEventListener("click", () => warning.remove());
    box.append(text, close);
    root.append(box);
    document.body.append(warning);
    setTimeout(() => warning.remove(), 15000);
  }

  document.addEventListener(STATUS, (event) => {
    // MAIN-world/page data is advisory and forgeable, never an authority.
    if (typeof event.detail !== "string" || event.detail.length > 256) return;
    let value;
    try { value = JSON.parse(event.detail); } catch { return; }
    if (!value || !["waiting", "applied", "incompatible", "error"].includes(value.state) ||
        !reasons.has(value.reason)) return;
    diagnostic = { state: value.state, reason: value.reason };
    if (value.state === "applied") warning?.remove();
    if (["incompatible", "error"].includes(value.state)) showWarning();
  });

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "gfn-pi-compat:get-status") return;
    document.dispatchEvent(new CustomEvent(REQUEST));
    respond(diagnostic);
  });
  document.dispatchEvent(new CustomEvent(REQUEST));
  setTimeout(() => {
    if (diagnostic.state === "waiting") {
      diagnostic = { state: "unknown", reason: "no-terminal-main-world-status" };
    }
    showWarning();
  }, 47000);
})();
