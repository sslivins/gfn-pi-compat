# Technical notes

## Hook contract

The declarative, top-frame `MAIN` content script runs at `document_start`,
intercepts `window.webpackChunkgfn_mall`, preserves existing array entries, and
wraps only module `56123`. After the original factory returns, it requires an
own callable `exports.configureOverrideSettings`, then calls:

```js
exports.configureOverrideSettings({ overrideData: "h265=1" });
```

Factory receiver, arguments, return value and thrown errors are preserved;
override errors also propagate. There are no unknown-module scans, alternative
patches, UA changes, authentication/entitlement bypasses, codec capability
replacements or forced stream negotiation. Other explicit GFN developer
overrides may be affected by the site's settings API; do not combine this
with unrelated override experiments.

The module/export guard is a compatibility check, not a GFN version proof.
If the contract changes, hooks are blocked, or no successful invocation occurs
within 45 seconds, status becomes incompatible/error and further override
attempts stop until reload. Slow loading can therefore require a reload.
Original site code still runs and retains its errors.

An isolated-world script displays a dismissible, 15-second failure notice,
including when MAIN-world status is missing after 47 seconds. Applied status
means only that the settings call returned, not that a particular codec,
decoder, resolution or frame rate was selected.

## Security model

There are no requested API permissions, background service, remote code,
extension network requests, update URL, telemetry, storage or externally
connectable messaging. Automatic page access is limited to the top frame of
`https://play.geforcenow.com/`.

The popup uses permission-free tab query/message/create operations; it does
not read tab URLs. MAIN-world code shares the page's environment/CSP and is
not isolated from page tampering. DOM status messages are strictly bounded
advisory text: pages can forge them, hide warnings or interfere with the hook.
They never trigger privileged actions. This is not a security boundary.

## Recorded streaming evidence

The following measurements describe one session, not a guarantee for other
browser versions, devices or games.

| Item | Observation |
|---|---|
| Session | September 16, 2026; Pi 5; LEGO Bricktales Demo |
| Software | Chromium 152.0.7977.75; GFN 2.0.88.129 |
| Isolation | Normal user; namespace and Seccomp sandboxing enabled |
| Video | H.265 Main; 1920x1080 at approximately 60 fps |
| Decoder | `ExternalDecoder (V4L2VideoDecoder)`; `powerEfficientDecoder=true` |
| Interval | 121.6 seconds; 7,261 additional decoded frames |
| Drops/freezes | No additional drops or freezes; 26 drops before the interval |
| Capture | Remote-control screencast disabled during measurement |

This establishes live streaming, including menus, not interactive gameplay,
controller acceptance, 4K60 or HDR display output. A separate real Chromium
integration fixture exercised document-start injection under strict page CSP.

The session used a temporary workaround for a separate browser startup crash.
[Chromium v0.4.1](https://github.com/sslivins/chromium-rpi-hevc/releases/tag/v0.4.1)
fixes that missing-keymap crash. Its packaged browser has separate hardware
decoder evidence documented in its release notes; the session above must not
be represented as having run on that newer browser.

## Reproducible package

`tools/package.py` allowlists runtime files, the license and README, normalizes
CRLF, fixes ZIP timestamps/modes/order, and uses uncompressed entries for
deterministic bytes. The ZIP has `manifest.json` at its root. Technical notes
remain in the repository and are linked from the packaged README.

README changes change the archive checksum even when runtime code and the
extension version are unchanged. Consumers pinning an existing commit/archive
must retain that archive's original checksum.
