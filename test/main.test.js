"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
const GLOBAL = "webpackChunkgfn_mall";
const STATUS = "gfn-pi-compat:status:v1";
const REQUEST = "gfn-pi-compat:request:v1";

function boot(window = {}) {
  const document = new EventTarget();
  const states = [];
  const timers = new Map();
  let timerId = 0;
  document.addEventListener(STATUS, event => states.push(JSON.parse(event.detail)));
  vm.runInNewContext(source, {
    window, document, CustomEvent,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  }, { filename: "main.js" });
  return {
    window, document, states, timers,
    get chunks() { return window[GLOBAL]; },
    get status() {
      document.dispatchEvent(new CustomEvent(REQUEST));
      return states.at(-1);
    },
    expire() {
      for (const [id, timer] of timers) { timers.delete(id); timer.fn(); }
    }
  };
}

function register(app, factory, id = 56123) {
  const modules = { [id]: factory };
  app.chunks.push([[1], modules]);
  return modules[id];
}

test("preserves factory receiver, all arguments, return, and export receiver", () => {
  const app = boot();
  const receiver = {};
  const args = [{}, {}, () => {}, "extra"];
  const sentinel = {};
  let calls = 0;
  const factory = register(app, function (...actual) {
    assert.equal(this, receiver);
    assert.deepEqual(actual, args);
    actual[1].configureOverrideSettings = function (settings) {
      assert.equal(this, args[1]);
      assert.equal(settings.overrideData, "h265=1");
      assert.deepEqual(Object.keys(settings), ["overrideData"]);
      calls++;
    };
    return sentinel;
  });
  assert.equal(Reflect.apply(factory, receiver, args), sentinel);
  assert.equal(calls, 1);
  assert.deepEqual(app.status, { state: "applied", reason: "eligibility-override-only" });
  assert.equal(app.timers.size, 0);
});

test("supports webpack getter exports, reading the exported function once", () => {
  const app = boot();
  let reads = 0;
  let calls = 0;
  const factory = register(app, (_, exports) => {
    Object.defineProperty(exports, "configureOverrideSettings", {
      get() { reads++; return () => { calls++; }; }
    });
  });
  factory({}, {});
  assert.equal(reads, 1);
  assert.equal(calls, 1);
});

test("retains existing chunk array, entries, and unrelated factories", () => {
  const untouched = () => {};
  const modules = { 56123: (_, exports) => { exports.configureOverrideSettings = () => {}; }, 9: untouched };
  const entry = [[1], modules];
  const chunks = [entry];
  const app = boot({ [GLOBAL]: chunks });
  assert.equal(app.chunks, chunks);
  assert.equal(chunks[0], entry);
  assert.equal(chunks.length, 1);
  assert.equal(modules[9], untouched);
  modules[56123]({}, {});
  assert.equal(app.status.state, "applied");
});

test("does not patch or execute unknown modules", () => {
  const app = boot();
  let called = false;
  const factory = () => { called = true; };
  assert.equal(register(app, factory, 99999), factory);
  assert.equal(called, false);
  assert.equal(app.status.state, "waiting");
});

test("does not patch inherited module IDs", () => {
  const app = boot();
  const factory = () => {};
  const modules = Object.create({ 56123: factory });
  app.chunks.push([[1], modules]);
  assert.equal(Object.hasOwn(modules, "56123"), false);
  assert.equal(app.status.state, "waiting");
});

test("preserves push receiver, all entries, and return value", () => {
  const app = boot();
  const receiver = {};
  const entries = [[[1], {}], [[2], {}]];
  const sentinel = {};
  app.chunks.push = function (...actual) {
    assert.equal(this, receiver);
    assert.deepEqual(actual, entries);
    return sentinel;
  };
  assert.equal(Reflect.apply(app.chunks.push, receiver, entries), sentinel);
});

test("webpack runtime push rebinding works and factory wrapping is idempotent", () => {
  const app = boot();
  const parentPush = app.chunks.push.bind(app.chunks);
  app.chunks.push = function (...entries) { return parentPush(...entries); };
  const modules = { 56123: (_, exports) => { exports.configureOverrideSettings = () => {}; } };
  const entry = [[1], modules];
  assert.equal(app.chunks.push(entry), 1);
  const wrapped = modules[56123];
  assert.equal(app.chunks.push(entry), 2);
  assert.equal(modules[56123], wrapped);
  wrapped({}, {});
  assert.equal(app.status.state, "applied");
});

test("same original factory is wrapped once across chunk maps", () => {
  const app = boot();
  const original = () => {};
  assert.equal(register(app, original), register(app, original));
});

test("intercepts an explicitly replaced array without discarding its entries", () => {
  const app = boot();
  const modules = { 56123: (_, exports) => { exports.configureOverrideSettings = () => {}; } };
  const replacement = [[[5], modules]];
  app.window[GLOBAL] = replacement;
  assert.equal(app.chunks, replacement);
  assert.equal(app.chunks.length, 1);
  modules[56123]({}, {});
  assert.equal(app.status.state, "applied");
});

test("preserves original factory exception identity and never calls override after it", () => {
  const app = boot();
  const failure = new Error("original");
  let configured = false;
  const factory = register(app, (_, exports) => {
    exports.configureOverrideSettings = () => { configured = true; };
    throw failure;
  });
  assert.throws(() => factory({}, {}), error => error === failure);
  assert.equal(configured, false);
  assert.equal(app.status.reason, "factory-threw");
});

test("preserves override exception identity", () => {
  const app = boot();
  const failure = new Error("override");
  const factory = register(app, (_, exports) => {
    exports.configureOverrideSettings = () => { throw failure; };
  });
  assert.throws(() => factory({}, {}), error => error === failure);
  assert.equal(app.status.reason, "override-threw");
});

test("preserves exported getter exception identity", () => {
  const app = boot();
  const failure = new Error("getter");
  const factory = register(app, (_, exports) => {
    Object.defineProperty(exports, "configureOverrideSettings", { get() { throw failure; } });
  });
  assert.throws(() => factory({}, {}), error => error === failure);
});

test("preserves original push exceptions", () => {
  const app = boot();
  const failure = new Error("push");
  app.chunks.push = () => { throw failure; };
  assert.throws(() => app.chunks.push([[], {}]), error => error === failure);
});

for (const value of [undefined, null, 1, {}, { configureOverrideSettings: 3 },
  Object.create({ configureOverrideSettings() { throw new Error("must not run"); } })]) {
  test(`rejects incompatible export shape: ${String(value)}`, () => {
    const app = boot();
    const factory = register(app, () => 123);
    assert.equal(factory({}, value), 123);
    assert.deepEqual(app.status, { state: "incompatible", reason: "export-mismatch" });
  });
}

test("fails closed after timeout, while still invoking site factories", () => {
  const app = boot();
  let originalCalls = 0;
  let configured = 0;
  const factory = register(app, (_, exports) => {
    originalCalls++;
    exports.configureOverrideSettings = () => { configured++; };
    return 7;
  });
  assert.equal([...app.timers.values()][0].ms, 45000);
  app.expire();
  assert.equal(factory({}, {}), 7);
  assert.equal(originalCalls, 1);
  assert.equal(configured, 0);
  assert.equal(app.status.reason, "module-timeout");
  const untouched = () => {};
  assert.equal(register(app, untouched), untouched);
});

test("applies at most once, without skipping later original invocations", () => {
  const app = boot();
  let originals = 0;
  let overrides = 0;
  const factory = register(app, (_, exports) => {
    originals++;
    exports.configureOverrideSettings = () => { overrides++; };
  });
  factory({}, {});
  factory({}, {});
  assert.equal(originals, 2);
  assert.equal(overrides, 1);
});

test("nonwritable target factory fails closed without preventing chunk delivery", () => {
  const app = boot();
  const original = () => {};
  const modules = Object.freeze({ 56123: original });
  assert.equal(app.chunks.push([[1], modules]), 1);
  assert.equal(modules[56123], original);
  assert.equal(app.status.reason, "factory-shape-mismatch");
});

test("known module accessor is rejected without invoking its getter", () => {
  const app = boot();
  const modules = {};
  Object.defineProperty(modules, "56123", { get() { throw new Error("must not run"); } });
  app.chunks.push([[1], modules]);
  assert.equal(app.status.reason, "factory-shape-mismatch");
});

test("nonconfigurable or nonwritable global is left alone", () => {
  for (const descriptor of [{ configurable: false, writable: true }, { configurable: true, writable: false }]) {
    const window = {};
    const value = [];
    Object.defineProperty(window, GLOBAL, { ...descriptor, value });
    const before = Object.getOwnPropertyDescriptor(window, GLOBAL);
    const app = boot(window);
    assert.deepEqual(Object.getOwnPropertyDescriptor(window, GLOBAL), before);
    assert.equal(app.status.reason, "global-property-mismatch");
  }
});

test("global accessors are rejected without reading them", () => {
  const window = {};
  Object.defineProperty(window, GLOBAL, { configurable: true, get() { throw new Error("must not run"); } });
  const app = boot(window);
  assert.equal(app.status.reason, "global-property-mismatch");
});

test("non-array chunks and frozen arrays report incompatibility", () => {
  assert.equal(boot({ [GLOBAL]: {} }).status.reason, "chunk-array-mismatch");
  assert.equal(boot({ [GLOBAL]: Object.freeze([]) }).status.reason, "chunk-hook-failed");
});

test("noncallable push assignment preserves site value", () => {
  const app = boot();
  app.chunks.push = null;
  assert.equal(app.chunks.push, null);
  assert.equal(app.status.reason, "push-not-callable");
});

test("non-array assignment preserves site value", () => {
  const app = boot();
  app.window[GLOBAL] = null;
  assert.equal(app.chunks, null);
  assert.equal(app.status.reason, "chunk-array-mismatch");
});
