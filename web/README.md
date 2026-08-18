# p88 web

Password-gated web app. Upload a match photo, adjust the crop, generate a
transparent screenprint illustration.

## Local

```bash
npm install          # from the project root — this is a workspace
cd web && npm run dev # http://localhost:3088
```

Env comes from `web/.env.local`:

```
GOOGLE_API_KEY=...   # billing-enabled Google Cloud project
APP_PASSWORD=...     # shared password. Leave EMPTY to disable the gate locally
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it in Vercel. **Set the root directory to `web`.**
   (It's an npm workspace — Vercel installs from the repo root and builds `web`.)
3. Add both env vars in Vercel → Settings → Environment Variables.
4. Deploy. Staff visit the URL and enter the password once; a cookie keeps them
   signed in for 30 days.

## How it works

```
browser                          server
───────                          ──────
downscale to 3000px  ──POST──▶   /api/preflight
                                   vision triage → verdict + proposed crop
crop UI (operator adjusts)
                     ──POST──▶   /api/generate
                                   crop → generate → ink separation
                                   → transparent PNG + stencil PNG
download
```

The API key never reaches the browser. Both routes run on Node (sharp needs it).

**Photos are downscaled client-side before upload.** Camera files run 5–25MB and
the larger ones exceed the request body limit outright; staff also shoot from
the sideline on mobile data. 3000px keeps far more detail than the pipeline
needs — the crop is upscaled to 1280px.

## Files

```
app/page.tsx        upload → preflight → crop → result
app/crop-box.tsx    draggable crop box (source-pixel coordinates)
app/downscale.ts    client-side resize before upload
app/api/preflight   vision triage + proposed crop
app/api/generate    generate + ink separation
proxy.ts            shared-password gate
```

The pipeline itself lives in the `p88-core` workspace package, shared with the
`p88` CLI. Change it once, both get it.

## Known

- Sponsor logos occasionally still render legibly. Parked with the AD.
- No generation history — each session is one-shot.
- Single shared password, not per-user accounts.
