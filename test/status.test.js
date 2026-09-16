"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "status.js"), "utf8");

function boot(withBody = true) {
  class Element extends EventTarget {
    style = {};
    children = [];
    removed = false;
    append(...children) { this.children.push(...children); }
    attachShadow() { this.shadow = new Element(); return this.shadow; }
    setAttribute() {}
    remove() { this.removed = true; }
  }
  const document = new EventTarget();
  const body = new Element();
  document.body = withBody ? body : null;
  document.createElement = () => new Element();
  const timers = [];
  let listener;
  const chrome = { runtime: { id: "extension-id", onMessage: {
    addListener(fn) { listener = fn; }
  } } };
  vm.runInNewContext(source, {
    document, chrome, CustomEvent,
    setTimeout(fn, ms) { timers.push({ fn, ms }); }
  });
  return {
    document, body, timers,
    emit(detail) {
      document.dispatchEvent(new CustomEvent("gfn-pi-compat:status:v1", { detail }));
    },
    status(sender = { id: "extension-id" }, message = { type: "gfn-pi-compat:get-status" }) {
      let result;
      listener(message, sender, value => { result = value; });
      return result;
    }
  };
}

test("unknown MAIN-world status triggers a dismissible notice at 47s, removed at 15s", () => {
  const app = boot();
  assert.equal(app.timers[0].ms, 47000);
  app.timers[0].fn();
  assert.equal(app.body.children.length, 1);
  const warning = app.body.children[0];
  const button = warning.shadow.children[0].children[1];
  button.dispatchEvent(new Event("click"));
  assert.equal(warning.removed, true);
  assert.equal(app.timers[1].ms, 15000);
  app.timers[1].fn();
});

test("failure notice waits for body, does not repeat, and uses fixed text", () => {
  const app = boot(false);
  app.emit(JSON.stringify({ state: "incompatible", reason: "module-timeout" }));
  assert.equal(app.body.children.length, 0);
  app.document.body = app.body;
  app.document.dispatchEvent(new Event("DOMContentLoaded"));
  assert.equal(app.body.children.length, 1);
  app.emit(JSON.stringify({ state: "error", reason: "factory-threw" }));
  assert.equal(app.body.children.length, 1);
});

test("applied reports advisory state and suppresses timeout warning", () => {
  const app = boot();
  app.emit(JSON.stringify({ state: "applied", reason: "eligibility-override-only" }));
  assert.equal(app.status().state, "applied");
  app.timers[0].fn();
  assert.equal(app.body.children.length, 0);
});

test("waiting without terminal status becomes unknown", () => {
  const app = boot();
  app.emit(JSON.stringify({ state: "waiting", reason: "waiting-for-module" }));
  app.timers[0].fn();
  assert.equal(app.status().state, "unknown");
  assert.equal(app.body.children.length, 1);
});

test("rejects malformed, oversized, unknown-state and unknown-reason page messages", () => {
  const app = boot();
  for (const detail of [
    null, {}, "null", "{", "x".repeat(257),
    '{"state":"execute","reason":"module-timeout"}',
    '{"state":"error","reason":"<script>alert(1)</script>"}'
  ]) app.emit(detail);
  assert.equal(app.status().state, "unknown");
  assert.equal(app.body.children.length, 0);
});

test("only own extension diagnostic requests receive responses", () => {
  const app = boot();
  assert.equal(app.status({ id: "another-extension" }), undefined);
  assert.equal(app.status({}, { type: "gfn-pi-compat:get-status" }), undefined);
  assert.equal(app.status({ id: "extension-id" }, { type: "execute" }), undefined);
});
