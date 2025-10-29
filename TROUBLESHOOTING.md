# Box Builder JavaScript Troubleshooting Guide

## Quick Start (Run the server)

Open PowerShell and run these commands one at a time:

```powershell
cd c:\Users\ryang\Desktop\Code\BoxBuilder
python main.py
```

Then open your browser to: http://127.0.0.1:8000/box-builder

## If that doesn't work, try:

```powershell
cd c:\Users\ryang\Desktop\Code\BoxBuilder
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Testing the JavaScript Locally

Open test_builder.html in your browser directly (double-click the file).
Then open DevTools (F12) and check the Console tab for errors.

## Common Issues

### 1. Server not running
- Make sure you see "Uvicorn running on http://127.0.0.1:8000" in the terminal
- If you see an error, read it carefully

### 2. JavaScript not loading
Open DevTools (F12) > Network tab:
- Look for box_builder.js
- If it's red or 404, the file path is wrong
- If it's there and green (200), the JS file loaded successfully

### 3. JavaScript errors
Open DevTools (F12) > Console tab:
- Look for red error messages
- Common errors:
  - "Cannot read property... of null" = element not found in HTML
  - "Unexpected token" = syntax error in JS
  - No errors but nothing happens = check if event listener is firing

### 4. Elements not found
The JavaScript looks for:
- `<div id="lm-root">` - MUST exist
- `<form class="box-lm-form">` - MUST be inside lm-root
- Various input/select elements with specific names

## Debug Mode

Replace the script tag in box_builder.html with:
```html
<script src="/static/js/box_builder_test.js?v={{ cache_bust }}" defer></script>
```

This will show detailed console logs for every step.

## What to check RIGHT NOW:

1. Is the server running? (Look for terminal output)
2. Can you access http://127.0.0.1:8000 in browser?
3. Can you access http://127.0.0.1:8000/box-builder ?
4. Open DevTools Console (F12) - what errors do you see?
5. Open DevTools Network tab - does box_builder.js load (status 200)?

## Tell me:
- What happens when you try to start the server?
- What do you see in the browser when you visit /box-builder?
- What errors (if any) appear in the browser console (F12)?
