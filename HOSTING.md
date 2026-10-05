# Publishing IFP Lyd on GitHub Pages (step by step, no programming needed)

Cost: free. You need a GitHub account and this `site` folder.

## 1. Create a GitHub account and a repository
1. Go to github.com and sign up (free).
2. Click **+** (top right) > **New repository**. Name it, for example, `ifp-lyd`. Choose **Public** (free Pages needs public). Create it.

## 2. Upload the site
**Easiest (GitHub Desktop app):** install GitHub Desktop, sign in, *File > Add local repository* / clone your new repository, copy
the *contents* of the `site` folder (index.html, css, js, data, audio, ... including the hidden `.nojekyll` file) into the repository
folder, write a summary, click **Commit** then **Push origin**.
**Browser upload:** works for small files only. GitHub's web upload accepts up to 100 files at a time and files up to 25 MB, and we have
65 audio files, so GitHub Desktop or git is recommended.
**Command line (git):**
```
cd site
git init && git add -A && git commit -m "IFP Lyd"
git branch -M main
git remote add origin https://github.com/dramanuj/ifp-lyd.git
git push -u origin main
```
Put the folder *contents* at the repository root (so `index.html` is at the top level).

## 3. Turn on Pages
Repository **Settings > Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch `main`, folder **/(root)**, **Save**.
After 1 to 3 minutes the address appears at the top of that page: `https://dramanuj.github.io/ifp-lyd/`. Open it and test.
All links in the site are relative, so the sub-path `/ifp-lyd/` works.

## 4. Zip downloads (GitHub Releases)
A single file in the repository may not exceed 100 MB, so the zip files are NOT in the site folder.
1. Repository > **Releases** > **Create a new release**. Use a tag such as `v1`. Drag in the zip files (each can be up to 2 GB). **Publish release**.
2. `js/config.js` already points to `https://github.com/dramanuj/ifp-lyd/releases/latest/download/`. If the zip file names change, update `data/manifest.json` (the `downloads` list). Until the zips exist, the Downloads page shows "Not ready yet" for them. The single audio and transcript files always work.

## 5. Already set for you
`index.html` and `js/config.js` already use `https://dramanuj.github.io/ifp-lyd/` (social preview image, "How to cite", and the GitHub issues link used by "Report a mistake" and the rights-holder contact). If you move the site to another address, change those two files.

## 6. Updating later
Change files, commit, push (or upload). Pages republishes in a minute or two. If you re-generate audio, replace the files and update
`data/manifest.json`. Avoid committing the same large file many times: git keeps history and the repository gets heavy.

## 7. Custom domain (optional)
Settings > Pages > Custom domain; follow GitHub's DNS instructions (a `CNAME` record). Tick **Enforce HTTPS**.

## Size limits to know
- 100 MB per file (hard), repository recommended under 1 GB, published site about 1 GB, about 100 GB bandwidth a month (soft).
- This site is roughly 380 MB of audio plus data; keep zips in Releases, not in the repository.

## Before you go public
Read the rights notes in `LICENSE-CONTENT` and the About page: the learning material's text and the exam questions are third-party material
used pending verification of reuse terms. Consider contacting SIRI/UIM first. Pages are public even for a private repository on free plans.

## About robots.txt
Search robots read only `/robots.txt` at the top of a host (`https://dramanuj.github.io/robots.txt`). The file inside the `ifp-lyd` folder is only a hint, and we do not claim that it blocks anyone. The page also has `noai, noimageai` meta tags, which only some crawlers respect. To make a real robots.txt you would need a repository named `dramanuj.github.io`, or a custom domain.

## Reports of mistakes
"Report a mistake" opens a pre-filled GitHub issue at `https://github.com/dramanuj/ifp-lyd/issues/new`. Issues must be switched on in the repository settings (they are on by default). Visitors need a free GitHub account. Nothing is sent until they press the green button on GitHub.
