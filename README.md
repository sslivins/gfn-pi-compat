# GFN Pi Compat (experimental)

A Chromium extension that enables GeForce NOW's **H.265/HEVC eligibility**
on Raspberry Pi. It runs only on `https://play.geforcenow.com/` and does not
add decoder support or spoof browser capabilities.

## Requirements

- Raspberry Pi 5 / CM5 with a compatible 64-bit OS and graphics stack.
- HEVC-capable Chromium, such as
  [chromium-rpi-hevc v0.4.1 (Chromium 152.0.7977.82)](https://github.com/sslivins/chromium-rpi-hevc/releases/tag/v0.4.1).
  Use the matching `chromium`, `chromium-common`, `chromium-sandbox` and
  `chromium-l10n` packages from that release; see its OS requirements.
- A GeForce NOW account and the membership/access required for your games.

**[Cloudplay OS](https://github.com/sslivins/cloudplay-os) already bundles and
automatically loads this extension.** No manual installation is needed there.

## Install manually

1. Download or clone this repository, or extract the packaged extension ZIP.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the directory containing `manifest.json`, then open or reload
   `https://play.geforcenow.com/`. Pin the extension to access its popup.

For command-line use, place the extension at `/opt/gfn-pi-compat`, with
`manifest.json` at that directory's root. Close any browser using the dedicated
profile before launching:

```sh
chromium --user-data-dir="$HOME/.local/share/gfn-pi-profile" \
  --load-extension=/opt/gfn-pi-compat https://play.geforcenow.com/
```

This requires Chromium support for unpacked extensions; branded Chrome may
restrict `--load-extension`.

## Check or disable

The popup reports **waiting**, **applied**, **incompatible**, **error** or
**unknown**. If the override is not confirmed, reload the GFN page. Persistent
failures may indicate that GFN has changed its internals.

**Applied means the settings call returned, not that H.265 or hardware decoding
is active.** Confirm the negotiated codec and decoder using Chromium
WebRTC/media diagnostics during a stream.

To disable, use the popup's **Manage / disable extension** button, toggle the
extension off, then reload every GFN tab or restart Chromium. For command-line
installations, also remove the launch flag from future starts.

## Limitations and privacy

- Experimental and dependent on GFN internals; service updates can break it.
- 4K60, HDR output, and interactive gameplay/controller compatibility are not
  validated claims.
- No authentication or membership bypass. Keep Chromium's normal sandbox enabled.
- No extension telemetry, network requests, stored data or requested API permissions.
- Popup status is page-reported and advisory, not a security boundary.
- Not affiliated with or endorsed by NVIDIA.

## Development

Requires Node.js 22+ and Python 3.10+. From the repository directory:

```sh
npm test
npm run package
```

Packaging produces `dist/gfn-pi-compat-0.1.0.zip` and its `.zip.sha256`.
[CI](https://github.com/sslivins/gfn-pi-compat/actions/workflows/ci.yml)
uploads the unpacked-extension ZIP as an artifact; it does not publish releases.
See [technical notes](https://github.com/sslivins/gfn-pi-compat/blob/main/docs/technical-notes.md)
for the hook contract, security details and recorded measurements.
