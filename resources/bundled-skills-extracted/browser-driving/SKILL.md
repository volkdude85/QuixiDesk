---
name: browser-driving
description: "Drive a real browser — Brave over CDP, Firefox over WebDriver BiDi, curl only as the last resort."
version: 1.0.0
tags: [browser, cdp, cloudflare, scraping, brave, firefox, curl]
---

# Driving a browser you control

Most "the site blocked me" failures are a transport mistake, not a bot-detection problem. Pick the
wrong transport and you spend an hour tuning headers against a wall that a real browser walks
through. This skill is the order of attack.

## The order of attack

1. **A real browser, debug mode, your own profile.** Beats almost every wall.
2. **A real browser, fresh profile.** When the site should not see your logged-in state.
3. **`curl` / plain HTTP.** Fast, and correct for APIs, JSON, and anything that is not a wall.
4. **Never**: scraping HTML with a regex over a hand-rolled fetch and calling a zero-result answer "no
   results". That mistake looks identical to a genuinely empty page.

## Which engine, which driver

| browser | driver | how it attaches |
|---|---|---|
| Brave / Chrome / Chromium | **CDP** | `--remote-debugging-port=<port>` |
| Firefox (incl. Mullvad Browser) | **WebDriver BiDi** via `geckodriver` | Selenium 4.46+ or raw BiDi |
| WebKit | WebDriver | `webkit2gtk-driver` |

**Firefox has had no CDP since version 129.** Selenium dropped CDP-for-Firefox; it is WebDriver BiDi
now. Anything that says "attach to Firefox over CDP" is describing a browser that no longer exists.
Do not write a CDP-for-Firefox driver.

## Brave / Chromium over CDP

Launch with a dedicated profile directory and the debug port:

```bash
brave --remote-debugging-port=9222 \
      --user-data-dir="$HOME/.cache/browser-profile" \
      --no-first-run --no-default-browser-check \
      about:blank
```

Then drive it. The HTTP surface is enough for most work:

```bash
curl -s http://127.0.0.1:9222/json/version      # ws endpoint
curl -s http://127.0.0.1:9222/json/list         # open tabs
curl -s -X PUT "http://127.0.0.1:9222/json/new?https://example.com"
```

Attach to a tab and run JS over the WebSocket:

```python
import json, websocket
ws = websocket.create_connection(target["webSocketDebuggerUrl"])
def call(method, **params):
    ws.send(json.dumps({"id": 1, "method": method, "params": params}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == 1:
            return msg

call("Runtime.evaluate", expression="document.title", returnByValue=True)
```

Gotchas that cost real time:

- **Port 9222 is usually the user's own browser.** If they are working in Brave, your calls land in
  their session. Use a second profile on a second port (9223) for your own work.
- **A relaunch with the same `--user-data-dir` is a no-op.** The existing process takes the request
  and keeps its old flags. `--start-fullscreen` "did nothing" because of this. Kill it, or use a new
  profile directory.
- **Native Wayland windows are invisible to `xdotool`.** Launch with `--ozone-platform=x11` if you
  need window geometry, and verify with `xdotool getwindowgeometry` before claiming placement.

## Firefox / Mullvad over WebDriver BiDi

```python
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

opts = Options()
opts.add_argument("-profile"); opts.add_argument("/path/to/profile")
drv = webdriver.Firefox(options=opts, service=Service("/usr/bin/geckodriver"))
drv.get("https://example.com")
```

Run it with the **system** python if the venv lacks selenium. Check first: `python3 -c "import selenium"`.

Mullvad Browser ships hardened anti-fingerprinting. It is the right choice when the *identity* matters;
it is the wrong choice when you need speed, because it deliberately adds noise.

## Passing a wall — what actually works

A real browser with a real profile passes almost everything, because it **is** a real browser with a
real history. What you should reach for, in order:

1. **A profile the site already trusts.** Cookie, local storage, existing session. A logged-in Brave or
   a Firefox profile that has used the site before.
2. **A real browser at all.** Most Cloudflare "blocked" results are a `curl` with no JS engine and a
   `User-Agent` that says `python-requests`.
3. **Slowness.** Rate-limited walls respond to pacing, not to more parallelism. Eight parallel streams
   do not beat a link that is already pinned.
4. **A different egress.** Multihop VPN is measurably slower; check whether a single hop or none is
   what the site wants before assuming the IP is the problem.

**Do not** spend a session building a fingerprint spoofing layer. If a real browser with a real profile
does not work, the site wants a human, and no amount of patching a TLS hello changes that.

## curl — when it is right, and how to tell it worked

curl is correct for JSON APIs, feeds, and raw file downloads. It is wrong for a wall.

Two rules that prevent the classic false negative:

- **Check the status code.** A search helper that discards the HTTP status reports a `429` or a `202`
  challenge as "zero results". Capture the code and raise on it.
- **Read the snippet, not the title.** For search results, the useful text is usually in the snippet.

```bash
curl -sS -o page.html -w '%{http_code}\n' \
     -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36' \
     'https://example.com/'
```

Downloads that stall silently: give curl a floor.

```bash
curl -L --retry-all-errors --retry 3 \
     --speed-limit 2048 --speed-time 45 -o file.bin URL
```

Without `--speed-limit`, a stalled transfer sits at zero bytes and looks like a slow success.

## Escalation ladder, in one place

```
JSON API?            -> curl
Static HTML?         -> curl
Needs JS to render?  -> real browser (CDP)
Needs a session?     -> real browser + the profile that has it
Cloudflare wall?     -> real browser + profile. Slower. Do not parallelise.
Silent zero results? -> CHECK THE STATUS CODE BEFORE BELIEVING IT
```

## Verify before reporting

A "the site has nothing" answer must be distinguishable from "my transport failed". Print the status
code, the byte count, and one line of the body. If those are not in the output, the result is not a
finding — it is a guess wearing a result's clothes.
