# BLR Pothole Watch

A lightweight MVP for a Bengaluru pothole and bad-road accountability app. It is designed to make public road damage visible, group hotspots, and show which assembly constituency and MLA are under pressure to fix them.

## What this version includes

- Public-facing dashboard with Bengaluru sample reports
- Hotspot map rendered from latitude/longitude points
- Constituency accountability cards with pressure scores
- Citizen report form with photo attachments and `Use my location`
- Local mode for demo usage and optional live Supabase mode
- Supabase/PostGIS starter schema for turning this into a production app

## Run locally

Because this repo was created in an environment without Node installed, this MVP is built as a static app and can be run with any simple file server.

Using Python:

```bash
cd /Users/demi/Documents/New\ project/blrPoth
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Make it live

1. Copy `config.example.js` values into `config.js`.
2. Fill in your Supabase project URL and anon key.
3. Run the SQL in `supabase/schema.sql`.
4. Create a public storage bucket named `report-photos`.
5. Deploy this repo as a static site.

Without Supabase the app still works, but reports stay only in the browser.

## Suggested production stack

- Frontend: Next.js
- Database: Supabase Postgres + PostGIS
- Auth and storage: Supabase
- Maps: MapLibre or Leaflet with a hosted tile provider
- Hosting: Vercel or Cloudflare Pages

## Production roadmap

1. Replace the seeded data with Supabase-backed reports and constituency boundary data.
2. Add moderation, duplicate detection, and user auth.
3. Use PostGIS point-in-polygon queries to assign each report to the correct ward and constituency.
4. Add representative pages, fix-time tracking, and before/after verification.

## Files

- `index.html`: dashboard structure and form
- `styles.css`: full visual system and responsive layout
- `data.js`: Bengaluru sample constituencies and seeded reports
- `app.js`: filtering, GPS attach flow, photo handling, local mode, and Supabase integration
- `config.js`: local config file for live credentials
- `config.example.js`: safe template for deployment setup
- `supabase/schema.sql`: database design for the full app
