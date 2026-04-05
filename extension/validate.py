#!/usr/bin/env python3
"""Validate the DukiAI Memory Chrome extension."""

import json
import os
import re
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with open("manifest.json") as f:
    manifest = json.load(f)

errors = []

# Required fields
for field in ["manifest_version", "name", "version", "description"]:
    if field not in manifest:
        errors.append(f"Missing required field: {field}")

if manifest.get("manifest_version") != 3:
    errors.append("Must be manifest_version 3")

# Check all referenced files exist
files_to_check = [
    manifest.get("action", {}).get("default_popup", ""),
    manifest.get("background", {}).get("service_worker", ""),
    manifest.get("options_ui", {}).get("page", ""),
]

for cs in manifest.get("content_scripts", []):
    files_to_check.extend(cs.get("js", []))

for icon_path in manifest.get("icons", {}).values():
    files_to_check.append(icon_path)
for icon_path in manifest.get("action", {}).get("default_icon", {}).values():
    files_to_check.append(icon_path)

for fp in files_to_check:
    if fp and not os.path.exists(fp):
        errors.append(f"Missing file: {fp}")

# Check HTML files reference valid scripts/styles
for html_file in ["popup.html", "options.html"]:
    if os.path.exists(html_file):
        with open(html_file) as f:
            content = f.read()
        scripts = re.findall(r'<script src="([^"]+)"', content)
        styles = re.findall(r'<link rel="stylesheet" href="([^"]+)"', content)
        for ref in scripts + styles:
            if not os.path.exists(ref):
                errors.append(f"{html_file} references missing file: {ref}")

# Validate JSON syntax check
try:
    with open("manifest.json") as f:
        json.load(f)
except json.JSONDecodeError as e:
    errors.append(f"manifest.json invalid JSON: {e}")

# Check background service worker doesn't use import/export (MV3 with importScripts)
if os.path.exists("background.js"):
    with open("background.js") as f:
        bg = f.read()
    if "import " in bg and "importScripts" not in bg:
        errors.append("background.js uses ES imports but manifest type is not 'module'")

if errors:
    print("ERRORS FOUND:")
    for e in errors:
        print(f"  x {e}")
    sys.exit(1)
else:
    print("OK: manifest.json is valid")
    print("OK: All referenced files exist")
    print("OK: All HTML references resolve")
    print()
    print("Extension files:")
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ("__pycache__",)]
        for fn in sorted(files):
            path = os.path.join(root, fn)
            size = os.path.getsize(path)
            print(f"  {path} ({size} bytes)")
