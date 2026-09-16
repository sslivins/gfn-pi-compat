"use strict";

const statusElement = document.getElementById("status");
const reasonElement = document.getElementById("reason");

async function refresh() {
  reasonElement.textContent = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.tabs.sendMessage(tab.id, { type: "gfn-pi-compat:get-status" });
    const labels = {
      waiting: "Waiting for the known GFN settings module.",
      applied: "Eligibility override applied (page-reported).",
      incompatible: "Incompatible / override not applied.",
      error: "Site/settings error; override not confirmed.",
      unknown: "Override status unknown."
    };
    statusElement.textContent = labels[result?.state] ?? labels.unknown;
    reasonElement.textContent = typeof result?.reason === "string" ? result.reason.slice(0, 100) : "";
  } catch {
    statusElement.textContent = "No diagnostics in this tab.";
    reasonElement.textContent = "Open https://play.geforcenow.com/ and reload after installing or enabling.";
  }
}

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("manage").addEventListener("click", () => {
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});
refresh();
