#!/usr/bin/env python3
"""Verify the three bug fixes are correctly applied."""

import json, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
errors = []

# 1) Verify manifest has save-link command
m = json.load(open('manifest.json'))
cmds = m.get('commands', {})
if 'save-link' not in cmds:
    errors.append('save-link command missing from manifest')
elif cmds['save-link']['suggested_key']['mac'] != 'Command+Shift+L':
    errors.append('save-link mac shortcut is not Command+Shift+L')
elif cmds['save-link']['suggested_key']['default'] != 'Ctrl+Shift+L':
    errors.append('save-link default shortcut is not Ctrl+Shift+L')
else:
    print('OK: manifest has save-link command (Cmd+Shift+L / Ctrl+Shift+L)')

if '_execute_action' in cmds and 'save-selection' in cmds and 'save-link' in cmds:
    print('OK: all 3 keyboard commands present')
else:
    errors.append('not all 3 commands present in manifest')

# 2) Verify CSS fix for spinner visibility
css = open('popup.css').read()
if '.btn-loading[hidden]' not in css:
    errors.append('missing .btn-loading[hidden] rule in popup.css')
elif 'display: none' not in css.split('.btn-loading[hidden]')[1][:60]:
    errors.append('.btn-loading[hidden] does not set display:none')
else:
    print('OK: popup.css has .btn-loading[hidden] { display: none }')

if '.btn-text[hidden]' not in css:
    errors.append('missing .btn-text[hidden] rule in popup.css')
else:
    print('OK: popup.css has .btn-text[hidden] { display: none }')

# 3) Verify popup.js calls updateSaveBtn() after link auto-fill
js = open('popup.js').read()
needle = 'linkInput.value = currentTabMeta.url;'
idx = js.find(needle)
if idx == -1:
    errors.append('link auto-fill code not found in popup.js')
else:
    after = js[idx:idx + 200]
    if 'updateSaveBtn()' in after:
        print('OK: popup.js calls updateSaveBtn() after link auto-fill')
    else:
        errors.append('updateSaveBtn() not called after link auto-fill in popup.js')

# 4) Verify background.js handles save-link command
bg = open('background.js').read()
cmd_handler_idx = bg.find("command === 'save-link'")
if cmd_handler_idx == -1:
    errors.append('background.js does not handle save-link command')
else:
    handler_block = bg[cmd_handler_idx:cmd_handler_idx + 1200]
    if 'smartSave' in handler_block:
        print('OK: background.js handles save-link with smartSave')
    else:
        errors.append('save-link handler does not call smartSave')

    # 5) Verify save-link handler checks for chrome:// pages
    if "tab.url.startsWith('chrome')" in handler_block:
        print('OK: save-link handler rejects chrome:// pages')
    else:
        errors.append('save-link handler does not reject chrome:// pages')

    # 6) Verify save-link extracts page metadata
    if 'GET_PAGE_META' in handler_block:
        print('OK: save-link handler extracts page metadata')
    else:
        errors.append('save-link handler does not extract page metadata')

print()
if errors:
    print('ERRORS:')
    for e in errors:
        print(f'  x {e}')
    sys.exit(1)
else:
    print('ALL CHECKS PASSED')
