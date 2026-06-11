# Deploying PSA Sucks v2

## How psa-sucks.com is wired (confirmed)
- **Host:** Vercel (scope: dlmgallant-7497s-projects)
- **DNS:** Cloudflare points the domain at Vercel
- **Grading API:** `api/analyze.js` — a Vercel serverless function that takes the
  browser's Gemini-shaped request and calls OpenAI **gpt-4o** server-side, using
  the `OPENAI_KEY` environment variable stored in Vercel (NOT in the repo).
  It returns the response reshaped to `{candidates:[{content:{parts:[{text}]}}]}`,
  which is exactly what the three grading tools parse.
- **Trade Advisor:** separate — calls Claude via the pokeedge Cloudflare Worker.

## CRITICAL: api/analyze.js is preserved
This project now includes `api/analyze.js` copied verbatim from the live repo.
Do NOT delete it — it IS your grading backend. Vercel auto-deploys any `api/*.js`
file at the repo root as a serverless function. The Vite app builds to `dist/`
and the function deploys alongside it, same domain, same origin.

## Environment variable (already set in Vercel, just confirm it survives)
- `OPENAI_KEY` — your OpenAI API key. Lives in Vercel Project → Settings →
  Environment Variables. Pushing code does not change it. If you ever recreate
  the project, you must re-add this or the grading tools 500.

## Deploy — if the Vercel project is connected to the GitHub repo (push-to-deploy)
From the project folder:
    git add -A
    git commit -m "v2: combined Grade + Edge platform"
    git push
Vercel detects the push, sees package.json, auto-runs `npm run build`, serves
`dist/`, and deploys `api/analyze.js`. Done.

## Deploy — if it is NOT git-connected (manual / CLI)
    npm i -g vercel
    vercel login
    vercel --prod
Run from the project root. Link to the existing project when prompted so it
deploys to the same domain (and keeps OPENAI_KEY). Or connect the repo in
Vercel → Project → Settings → Git for push-to-deploy going forward.

## Vercel build settings (zero-config, but verify)
- Framework preset: Vite
- Build command: npm run build
- Output directory: dist
- Install command: npm install
