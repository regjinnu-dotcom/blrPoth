# BLR Pothole Watch

A lightweight MVP for a Bengaluru pothole and bad-road accountability app. It is designed to make public road damage visible, group hotspots, and show which assembly constituency and MLA are under pressure to fix them.

## What this version includes

- Public-facing dashboard with Bengaluru sample reports
- Hotspot map rendered from latitude/longitude points
- Constituency accountability cards with pressure scores
- Citizen report form that stores new reports in browser `localStorage`
- Supabase/PostGIS starter schema for turning this into a production app

## Run locally

Because this repo was created in an environment without Node installed, this MVP is built as a static app and can be run with any simple file server.

Using Python:

```bash
cd /Users/demi/Documents/New\ project/blrPoth
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Suggested production stack

- Frontend: Next.js
- Database: Supabase Postgres + PostGIS
- Auth and storage: Supabase
- Maps: MapLibre or Leaflet with a hosted tile provider
- Hosting: Vercel or Cloudflare Pages

## Production roadmap

1. Replace the seeded data with Supabase-backed reports and constituency boundary data.
2. Add photo uploads, moderation, duplicate detection, and user auth.
3. Use PostGIS point-in-polygon queries to assign each report to the correct ward and constituency.
4. Add representative pages, fix-time tracking, and before/after verification.

## Files

- `index.html`: dashboard structure and form
- `styles.css`: full visual system and responsive layout
- `data.js`: Bengaluru sample constituencies and seeded reports
- `app.js`: filtering, map rendering, scoring, and local report persistence
- `supabase/schema.sql`: database design for the full app
