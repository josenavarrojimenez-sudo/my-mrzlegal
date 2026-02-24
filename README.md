# webapp

## Project Overview
- **Name**: webapp
- **Goal**: Pixel-perfect English replication of Krivitskiy.com with custom contact/newsletter pages, Spanish translation at `/es/`, and backend email delivery.
- **Main Features**:
  - Reverse-proxy frontend that mirrors https://krivitskiy.com (English site at `/en/`).
  - Machine-translated Spanish copy served at `/es/` (DeepL) with edge caching.
  - Guaranteed fallback snapshot for `/en/` when upstream is unavailable.
  - Custom contact page that matches the site style.
  - Custom newsletter signup page that matches the site style.
  - Contact + newsletter APIs that send email via Resend.

## URLs
- **Production**: https://webapp-e2q.pages.dev
- **Latest Deployment**: https://83ffed87.webapp-e2q.pages.dev
- **Primary English Entry**: `/en/` (root `/` redirects to `/en/`)
- **Spanish Entry**: `/es/`
- **Custom Contact Page**: `/en/contact/`
- **Custom Newsletter Page**: `/en/newsletter/`

## API Endpoints
- `GET /api/health` → health check.
- `POST /api/contact`
  - Body: `{ "name": "", "email": "", "message": "", "phone": "", "company": "" }`
  - Sends email notification via Resend.
- `POST /api/newsletter`
  - Body: `{ "email": "" }`
  - Sends email notification via Resend.

## Data Architecture
- **Storage**: None (email-only workflow).

## Required Environment Variables
Set locally in `.dev.vars` (not committed):
```
RESEND_API_KEY=your_resend_key
RESEND_FROM="jose@nambi.haus"
RESEND_TO=hello@nambi.haus
DEEPL_API_KEY=your_deepl_key
```

## User Guide
1. Visit `/en/` for the English site replica (fallback snapshot if upstream is down).
2. Visit `/es/` for the machine-translated Spanish version.
3. Use `/en/contact/` and `/en/newsletter/` to submit forms.
4. Configure Resend + DeepL secrets before deploying.

## Development
```bash
npm install
npm run build
npm run dev:sandbox
```

## Deployment
- **Platform**: Cloudflare Pages
- **Status**: ✅ Active
- **Build**: `npm run build`
- **Deploy**: `npm run deploy`

## Completed Features
- Reverse-proxy frontend for pixel-perfect replication.
- Guaranteed `/en/` fallback snapshot when upstream is unavailable.
- Custom contact + newsletter pages with matching typography and layout.
- Contact + newsletter backend APIs with Resend.
- `/es/` Spanish translation via DeepL with edge caching.

## Not Yet Implemented
- Spanish translations for custom contact/newsletter pages (currently English only).

## Recommended Next Steps
1. Set `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` in Cloudflare secrets.
2. Set `DEEPL_API_KEY` in Cloudflare secrets to enable Spanish translation.
3. (Optional) Translate the custom contact/newsletter pages into Spanish.
