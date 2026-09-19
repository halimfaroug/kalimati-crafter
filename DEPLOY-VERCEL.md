# Putting Kalimati on Vercel

Kalimati runs entirely in the browser (no database, no logins), so it deploys as a
normal Vite/TanStack Start app.

## 1. Get the code

In Lovable, use **GitHub → Connect to GitHub** and push the project to a repository.

## 2. Create the Vercel project

1. Go to vercel.com → **Add New… → Project** and import that repository.
2. Framework preset: **Other**
3. Build command: `npm run build`
4. Output directory: leave the default (the build writes `.output/`)
5. Install command: `npm install`

## 3. Tell the build to target Vercel

The build defaults to Cloudflare. On Vercel, add one Environment Variable
(Settings → Environment Variables), for all environments:

```
NITRO_PRESET = vercel
```

Then **Deploy** (or redeploy if you added the variable afterwards).

## 4. Notes

- Speech and microphone features need HTTPS — Vercel gives you that automatically.
- Progress, streaks, recordings and scores are stored in the visitor's own browser,
  so nothing needs to be configured server-side.
- A custom domain can be added in Vercel under Settings → Domains.

Publishing from Lovable (the **Publish** button) stays available and is the quicker
option if you don't specifically need Vercel.
