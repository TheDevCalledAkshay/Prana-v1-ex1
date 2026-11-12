# PRANA

Static site. No build step, no backend. GitHub Pages compatible.

## Run locally
```
python3 -m http.server 8000      # then open http://localhost:8000
```
(ES modules need a server; opening index.html by double-click will not work.)

## Deploy
Push the folder to a GitHub repo → Settings → Pages → deploy from branch `main`, root.

## Intro URLs
| URL | Does |
|---|---|
| `/` | Plays once per browser session |
| `/?intro` | Force replay |
| `/?nointro` | Skip |
| `/?calibrate` | Click your photo to place the bracelet on the wrist (see js/config.js) |
| `/?debug` | Pause at t=0; in console: `__pranaIntro.seek(4.5)` scrubs to any second |

## Swap in real footage
1. Put your photo/video in `assets/`, set `plate.src` in `js/config.js`.
2. Open `/?calibrate`, click the wrist, paste the readout into the config.

## Replace placeholder products
Drop real photos into `assets/img/` using the same filenames (4:5 ratio works best), or edit the `<img src>` in index.html.
`tools/make-placeholders.cjs` regenerates the placeholders; you don't need it once you have photos.

## Libraries
GSAP 3.12.5 and Three.js 0.170.0 load from jsDelivr (pinned versions, see index.html).
To self-host, download them into `js/vendor/` and point the `<script>` tags and importmap there.
