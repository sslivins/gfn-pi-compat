(() => {
  "use strict";

  const GLOBAL = "webpackChunkgfn_mall";
  const MODULE = "56123";
  const STATUS = "gfn-pi-compat:status:v1";
  const REQUEST = "gfn-pi-compat:request:v1";
  const TIMEOUT_MS = 45000;
  const wrappers = new WeakMap();
  const wrapped = new WeakSet();
  const arrays = new WeakSet();
  let state = "waiting";
  let reason = "waiting-for-module";
  let timer;

  function publish() {
    document.dispatchEvent(new CustomEvent(STATUS, {
      detail: JSON.stringify({ state, reason })
    }));
  }

  function finish(next, why) {
    if (state !== "waiting") return;
    state = next;
    reason = why;
    clearTimeout(timer);
    publish();
  }

  document.addEventListener(REQUEST, publish);
  timer = setTimeout(() => finish("incompatible", "module-timeout"), TIMEOUT_MS);

  function replaceFactory(factory) {
    if (wrapped.has(factory)) return factory;
    if (wrappers.has(factory)) return wrappers.get(factory);
    const replacement = function (...args) {
      let result;
      try {
        result = Reflect.apply(factory, this, args);
      } catch (error) {
        finish("error", "factory-threw");
        throw error;
      }
      if (state !== "waiting") return result;
      try {
        const exports = args[1];
        if (exports === null ||
            !["object", "function"].includes(typeof exports) ||
            !Object.prototype.hasOwnProperty.call(exports, "configureOverrideSettings")) {
          finish("incompatible", "export-mismatch");
          return result;
        }
        const configure = exports.configureOverrideSettings;
        if (typeof configure !== "function") {
          finish("incompatible", "export-mismatch");
          return result;
        }
        Reflect.apply(configure, exports, [{ overrideData: "h265=1" }]);
        finish("applied", "eligibility-override-only");
      } catch (error) {
        finish("error", "override-threw");
        throw error;
      }
      return result;
    };
    wrappers.set(factory, replacement);
    wrapped.add(replacement);
    return replacement;
  }

  function inspect(entry) {
    if (state !== "waiting" || !Array.isArray(entry)) return;
    const modules = entry[1];
    if (modules === null || typeof modules !== "object") return;
    // Never scan or execute unknown factories. This ID and export are the contract.
    try {
      const descriptor = Object.getOwnPropertyDescriptor(modules, MODULE);
      if (!descriptor) return;
      if (typeof descriptor.value !== "function" || !descriptor.writable) {
        finish("incompatible", "factory-shape-mismatch");
        return;
      }
      if (!Reflect.defineProperty(modules, MODULE, {
        ...descriptor, value: replaceFactory(descriptor.value)
      })) {
        finish("incompatible", "factory-not-writable");
      }
    } catch {
      // Only hook installation is contained; site factory/push errors propagate.
      finish("incompatible", "factory-hook-failed");
    }
  }

  function intercept(delegate) {
    return function (...entries) {
      for (const entry of entries) inspect(entry);
      return Reflect.apply(delegate, this, entries);
    };
  }

  function attach(chunks) {
    if (state !== "waiting") return;
    if (!Array.isArray(chunks)) {
      finish("incompatible", "chunk-array-mismatch");
      return;
    }
    if (arrays.has(chunks)) return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(chunks, "push");
      if (descriptor && (!descriptor.configurable || !descriptor.writable ||
          !("value" in descriptor))) {
        finish("incompatible", "push-property-mismatch");
        return;
      }
      if (typeof chunks.push !== "function") {
        finish("incompatible", "push-not-callable");
        return;
      }
      let push = intercept(chunks.push);
      Object.defineProperty(chunks, "push", {
        configurable: true,
        enumerable: descriptor?.enumerable ?? false,
        get: () => push,
        set(delegate) {
          if (typeof delegate !== "function") {
            finish("incompatible", "push-not-callable");
            push = delegate;
          } else {
            push = intercept(delegate);
          }
        }
      });
      arrays.add(chunks);
      for (const entry of chunks) inspect(entry);
    } catch {
      finish("incompatible", "chunk-hook-failed");
    }
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, GLOBAL);
    if (descriptor && (!descriptor.configurable || !descriptor.writable ||
        !("value" in descriptor))) {
      finish("incompatible", "global-property-mismatch");
      return;
    }
    let chunks = descriptor?.value;
    if (chunks === undefined) chunks = [];
    attach(chunks);
    if (state !== "waiting") return;
    Object.defineProperty(window, GLOBAL, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => chunks,
      set(value) {
        chunks = value;
        attach(value);
      }
    });
    publish();
  } catch {
    finish("incompatible", "global-hook-failed");
  }
})();
