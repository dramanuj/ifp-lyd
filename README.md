# IFP Lyd

Static website (no build step, no external requests) with 65 English audio lessons for the Danish citizenship
test (Indfødsretsprøven), synced transcripts, illustrations, a quiz of real exam questions, a history timeline,
search and downloads. Based on *Læremateriale til Indfødsretsprøven*, August 2026 edition. Unofficial study aid.

## Run it locally
```
python3 tools/serve.py --port 8000        # supports HTTP Range, so audio seeking works
# open http://localhost:8000/
```
Plain `python3 -m http.server` works for browsing but audio seeking can fail. Test a sub-path like GitHub Pages:
`python3 tools/serve.py --root . --prefix /ifp-lyd/` then open http://localhost:8000/ifp-lyd/.

## Layout
- `index.html`, `css/styles.css`, `js/` (config, data, store, guard, player, views*, quiz, app), `brand/` (logo, icons, OG image)
- `data/` manifest.json, quiz/, images/, search/ (generated, see contract below), `audio/`, `transcripts/`, `images/`
- `HOSTING.md` (publishing, for non-technical owners), `LICENSE`, `LICENSE-CONTENT`, `NOTICE.md`, `robots.txt`, `404.html`, `.nojekyll`

## Configuration: `js/config.js`
`DATA_BASE` (where data/audio/transcripts/images live), `RELEASE_BASE_URL` (zip files, GitHub Release), `PROTECT`
(light anti-scraping deterrent on/off), `SITE_URL`, `ISSUES_URL` (used by "Report a mistake"), `CONTACT`, `FLAGS_ENABLED` (parked feature, keep `false`). On localhost only, `?data=../some-folder/` points the site at another data folder.

## Data contract (all paths relative to the site folder)
- `data/manifest.json`: source (title, edition, publisher, ISBN), chapters > episodes > parts (audio, transcript, images, quiz, duration, quizStart, quizCount, pages, eraAnchors), eras, downloads, stats.
- `transcripts/chN/*.vtt`: one cue per sentence; second line `[DA] ...` carries Danish originals; answer cues end with `[DA] ✔ ...`.
- `data/quiz/<partId>.json`: questions with answer, Danish original, `qStart`, `aStart`, `aEnd` (spoiler range) and `learn` (where the fact is taught).
- `data/images/<partId>.json`: illustration cues with `start`/`end`, caption, alt, page. `data/search/chN.json`: `[partId, seconds, sentence]` (answer sentences excluded).
- Part ids are `chN-epE-pP`. Routes: `#/part/<partId>?t=<seconds>`, `#/episode/<epId>`, `#/chapter/N`, `#/quiz`, `#/quiz/part/<partId>`, `#/search?q=...`.

## Features worth knowing
- Spoiler-free transcript: quiz answers are not in the page until the narrator reads them (or you click "Reveal this answer").
- Quiz tab: no audio; wrong answers link to the podcast moment that teaches the fact, with a "Back to quiz" chip.
- Progress and quiz results are stored in the browser only with consent; nothing is stored before a choice.
- "Report a mistake" (player, transcript lines, footer) opens a pre-filled GitHub issue. It needs a free GitHub account and nothing is sent until the visitor presses the green button on GitHub.
- Pages: How to use (`#/howto`), Quiz, Downloads, My learning, About (with the accessibility statement), Privacy.
- Covers: `covers/<partId>.jpg` and `covers/chapter-N.jpg` (square) are used on cards and as lock-screen artwork; the logo is the fallback.
- Anti-scraping is best effort only: static hosting cannot prevent copying; audio, VTT and zips are public URLs.

## Licences
Code MIT; our narration/audio/compilation CC BY 4.0; the underlying learning material belongs to its owners (see `LICENSE-CONTENT`, `NOTICE.md`).

## Future work
Crowd-checked flags are parked. See the design notes in the project's future-flags folder. The code stub is `js/flags.js` and stays off while `FLAGS_ENABLED` is `false`.
