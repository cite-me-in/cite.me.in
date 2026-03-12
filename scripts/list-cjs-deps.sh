#!/usr/bin/env bash
# Lists CJS packages Vite pre-bundled that are imported from browser-side code.
# "Browser-side" = any file in app/ that doesn't have .server. in its name.
# Run after `vitest run` so node_modules/.vite-test/deps/_metadata.json exists.

set -euo pipefail

METADATA="node_modules/.vite-test/deps/_metadata.json"

if [[ ! -f "$METADATA" ]]; then
  echo "No metadata found at $METADATA — run the tests first." >&2
  exit 1
fi

python3 - "$METADATA" <<'EOF'
import json, sys, subprocess, pathlib, re

# --- Collect packages imported from browser-side source files ---
app_dir = pathlib.Path("app")
browser_packages: set[str] = set()
import_re = re.compile(r"""(?:import|from)\s+['"]([^'"]+)['"]""")

for f in app_dir.rglob("*"):
    if not f.is_file():
        continue
    if ".server." in f.name:
        continue
    if f.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
        continue
    try:
        src = f.read_text(errors="ignore")
    except OSError:
        continue
    for m in import_re.finditer(src):
        pkg = m.group(1)
        if pkg.startswith(".") or pkg.startswith("/") or pkg.startswith("~"):
            continue  # skip relative and alias imports
        # Normalize to package name (strip sub-paths, keep scope)
        parts = pkg.split("/")
        name = "/".join(parts[:2]) if pkg.startswith("@") else parts[0]
        browser_packages.add(name)

# --- Load Vite optimized list ---
with open(sys.argv[1]) as f:
    data = json.load(f)

results = []
for pkg in data.get("optimized", {}).keys():
    parts = pkg.split("/")
    base = "/".join(parts[:2]) if pkg.startswith("@") else parts[0]

    if base not in browser_packages:
        continue  # server-only, skip

    # Resolve package.json to determine CJS vs ESM
    try:
        out = subprocess.check_output(
            ["node", "-e", f"console.log(require.resolve('{base}'))"],
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
        p = pathlib.Path(out)
        pkgjson = next(
            (parent / "package.json" for parent in [p, *p.parents] if (parent / "package.json").exists()),
            None,
        )
    except subprocess.CalledProcessError:
        pkgjson = None

    if pkgjson:
        meta = json.loads(pkgjson.read_text())
        label = "ESM" if meta.get("type") == "module" else "CJS"
    else:
        label = "UNKNOWN"

    results.append((label, pkg))

for label, pkg in sorted(results):
    print(f"{label:<8} {pkg}")
EOF
