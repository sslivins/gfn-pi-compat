"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

async function boot(response, unavailable = false) {
  const elements = new Map();
  for (const id of ["status", "reason", "refresh", "manage"]) {
    elements.set(id, { textContent: "", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
  }
  const calls = [];
  const chrome = {
    runtime: { id: "test-extension" },
    tabs: {
      async query(options) { calls.push(["query", options]); return [{ id: 42 }]; },
      async sendMessage(id, message) {
        calls.push(["message", id, message]);
        if (unavailable) throw new Error("No receiver");
        return response;
      },
      create(options) { calls.push(["create", options]); }
    }
  };
  vm.runInNewContext(source, {
    document: { getElementById: id => elements.get(id) },
    chrome
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, calls };
}

test("popup labels applied as eligibility only and queries tab by ID", async () => {
  const app = await boot({ state: "applied", reason: "eligibility-override-only" });
  assert.equal(app.elements.get("status").textContent, "Eligibility override applied (page-reported).");
  assert.equal(app.calls[1][1], 42);
  assert.equal(app.calls[1][2].type, "gfn-pi-compat:get-status");
});

test("popup handles non-GFN tabs and absent content scripts", async () => {
  const app = await boot(undefined, true);
  assert.equal(app.elements.get("status").textContent, "No diagnostics in this tab.");
  assert.match(app.elements.get("reason").textContent, /reload/);
});

test("only explicit manage button opens native extension management", async () => {
  const app = await boot({ state: "error", reason: "override-threw" });
  assert.equal(app.calls.filter(call => call[0] === "create").length, 0);
  app.elements.get("manage").listeners.click();
  assert.equal(app.calls.at(-1)[0], "create");
  assert.equal(app.calls.at(-1)[1].url, "chrome://extensions/?id=test-extension");
});

test("popup treats arbitrary reason strings as bounded plain text", async () => {
  const app = await boot({ state: "unknown", reason: "<script>".repeat(40) });
  assert.equal(app.elements.get("reason").textContent.length, 100);
  assert.equal(app.elements.get("status").textContent, "Override status unknown.");
});
