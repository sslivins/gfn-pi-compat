"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("manifest is site-scoped, top-frame, document-start MV3 with no API privileges", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.update_url, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.deepEqual(manifest.content_scripts.map(script => script.world), ["MAIN", "ISOLATED"]);
  for (const script of manifest.content_scripts) {
    assert.deepEqual(script.matches, ["https://play.geforcenow.com/*"]);
    assert.equal(script.run_at, "document_start");
    assert.equal(script.all_frames, false);
    for (const file of script.js) assert.ok(fs.existsSync(path.join(root, file)));
  }
  assert.ok(fs.existsSync(path.join(root, manifest.action.default_popup)));
  assert.equal(manifest.version, JSON.parse(fs.readFileSync(path.join(root, "package.json"))).version);
});

test("packaging is byte-reproducible with root manifest and matching checksum", () => {
  const script = path.join(root, "tools", "package.py");
  execFileSync("python", [script], { cwd: root });
  const archive = path.join(root, "dist", `gfn-pi-compat-${manifest.version}.zip`);
  const first = fs.readFileSync(archive);
  execFileSync("python", [script], { cwd: root });
  assert.deepEqual(fs.readFileSync(archive), first);
  const checksum = createHash("sha256").update(first).digest("hex");
  assert.equal(fs.readFileSync(`${archive}.sha256`, "utf8"), `${checksum}  ${path.basename(archive)}\n`);
  const names = JSON.parse(execFileSync("python", ["-c",
    "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))",
    archive], { encoding: "utf8", cwd: root }));
  assert.deepEqual(names, ["LICENSE", "README.md", "main.js", "manifest.json", "popup.css", "popup.html", "popup.js", "status.js"]);
});
