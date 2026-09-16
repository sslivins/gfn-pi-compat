"""Create a deterministic unpacked-extension ZIP, using only Python's stdlib."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "LICENSE", "README.md", "main.js", "manifest.json", "popup.css",
    "popup.html", "popup.js", "status.js",
)


def build():
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    output = ROOT / "dist" / f"gfn-pi-compat-{version}.zip"
    output.parent.mkdir(exist_ok=True)
    # Stored entries avoid zlib/version-dependent compressed bytes.
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in sorted(FILES):
            data = (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
            entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_STORED
            archive.writestr(entry, data)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(".zip.sha256").write_text(
        f"{digest}  {output.name}\n", encoding="utf-8", newline="\n"
    )
    print(f"{output}\nSHA256 {digest}")


if __name__ == "__main__":
    build()
