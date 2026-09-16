# GFN Pi Compat (experimental)

Standalone Chromium Manifest V3 extension for **https://play.geforcenow.com/**
only. It enables GFN's HEVC eligibility policy via the known settings module,
not by spoofing browser or decoder capabilities.

## Status and limits

The underlying document-start override was validated via CDP on Chromium
**152.0.7977.75**, GFN **2.0.88.129**, with real H.265 V4L2 decoding at
**1080p60**. The packaged extension has also applied successfully on Pi 5 with
that browser running as a normal user with namespace and Seccomp sandboxing:
GFN's real capability checks returned H.265 and H.264. Gameplay with the
packaged extension is still awaiting validation. A real Chromium integration
fixture also exercised document-start injection under strict page CSP.
4K60 and HDR are future appliance goals, **not supported/validated claims**.
GFN updates can break the private module contract at any time.

## Load locally

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**.
2. Select this directory (or extract the ZIP and select its root).
3. Open/reload `https://play.geforcenow.com/`. Pin the extension for its popup.

For an experimental Chromium appliance, install the runtime files with
`manifest.json` directly under **`/opt/gfn-pi-compat`**. All resources are
relative to that root. Launch a *new* Chromium process with a dedicated profile:

```sh
chromium --user-data-dir="$HOME/.local/share/gfn-pi-profile" \
  --load-extension=/opt/gfn-pi-compat https://play.geforcenow.com/
```

Use an actual Chromium build supporting command-line unpacked extensions;
branded Chrome builds may restrict `--load-extension`. Close that dedicated
profile's existing browser processes first, or startup flags may be ignored.
No special decoder flags are supplied: provision and verify real decoder
support separately. This is an experimental **loaded extension**, not a signed
package, store distribution, kiosk lockdown, or complete Pi OS image.

**Disable:** popup → **Manage / disable extension** → toggle off in Chromium's
extension UI, then reload every GFN tab (or restart the browser). Disabling alone
does not undo code already run in a page. Remove the launch flag for future
appliance launches if you no longer want to load the extension.

## Intervention and diagnostics

The declarative, top-frame `MAIN` content script runs at `document_start`,
intercepts `window.webpackChunkgfn_mall`, preserves existing array entries, and
wraps **only module 56123**. After the original factory returns, it requires an
own callable `exports.configureOverrideSettings`, then calls:

```js
exports.configureOverrideSettings({ overrideData: "h265=1" });
```

Factory receiver, arguments, return value and thrown errors are preserved;
override errors also propagate. No unknown-module scans, alternative patches,
UA changes, authentication/entitlement bypasses, codec capability replacements,
or forced stream negotiation. Other explicit GFN developer overrides may be
affected by the site's settings API; do not combine this with unrelated
override experiments.

The module/export guard is a compatibility check, **not a GFN version proof**.
If the contract changes, hooks are blocked, or no successful invocation occurs
within 45 seconds, status becomes incompatible/error and further override
attempts stop until reload. Slow loading can therefore require a reload.
Original site code still runs and retains its errors.

An isolated-world script displays a dismissible, 15-second failure notice
(including missing MAIN-world status after 47 seconds). The popup reports
waiting/applied/incompatible/error/unknown. **Applied only means the settings
call returned**, not negotiated H.265, hardware decode, HDR, 4K, or 60 fps.
Verify actual sessions with Chromium WebRTC/media diagnostics and decoder
telemetry; do not infer success from this popup.

## Security

No requested API permissions, background service, remote code, extension network
requests, update URL, telemetry, storage, or externally connectable messaging.
The only automatic page access is the exact HTTPS origin above, top frame only.
The popup uses permission-free tab query/message/create operations; it does not
read tab URLs. MAIN-world code shares the page's environment/CSP and is not
isolated from page tampering. DOM status messages are strictly bounded advisory
text; pages can forge them, hide warnings, or interfere with the hook. They never
trigger privileged actions. This is not a security boundary or official NVIDIA
software. Service/browser changes and service policies remain external risks.

## Tests and reproducible artifact

Requires Node.js 22+ and Python 3.10+, no dependency installation:

```powershell
cd C:\Users\stesli\code\gfn-pi-compat
npm test
npm run package
```

Equivalent direct commands: `node --test` and `python tools/package.py`.
Output: `dist/gfn-pi-compat-0.1.0.zip` and matching `.zip.sha256`.
Packaging allowlists runtime files plus this README, normalizes CRLF, fixes ZIP
timestamps/modes/order, and uses uncompressed entries for deterministic bytes.
The ZIP has `manifest.json` at its root. CI tests and uploads this artifact only;
it does not publish releases or deploy anything.
