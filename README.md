# French Accounting App

Supabase-backed React app for an AI-powered French bookkeeping product aimed at freelancers and very small businesses.

Licensed as AGPL-3.0-or-later so the app stays free/open-source, including hosted forks.

## Included

- Core multi-tenant company and membership model
- Email/password auth with visible Google OAuth sign-in entrypoint
- French regime-aware company setup
- Invoicing, expenses, bank sync, reconciliation, VAT tracking
- Double-entry ledger with balancing enforcement
- Audit trail and non-destructive accounting posture
- `livre_des_recettes` and `registre_des_achats` export views
- Seeded French chart-of-accounts and VAT templates
- Private invoice and receipt uploads through Supabase Storage
- Client-side OCR scanning with the open-source `tesseract.js` package
- PWA manifest and service worker for installable app shell behavior
- PDF exports for invoices, tax analytics, P&L, balance sheet and account balances
- Local contract generation with contract register and PDF export
- React/Vite app shell with auth, company setup, dashboard, invoices, expenses, bank lines and tax/export snapshots

## Structure

- `supabase/migrations/20260424120000_init_accounting_core.sql`
- `supabase/migrations/20260424133000_second_company_default_fix.sql`
- `supabase/migrations/20260424143000_mvp_ledger_storage.sql`
- `supabase/migrations/20260424153000_reporting_einvoicing.sql`
- `supabase/migrations/20260424160000_invoice_documents_pwa.sql`
- `supabase/seed.sql`
- `src/App.tsx`
- `public/manifest.webmanifest`
- `public/sw.js`
- `.env.example`

## Local usage

1. Fill local environment variables from `.env.example`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Start local Supabase with `supabase start` if you want a local database.
5. Apply the schema locally with `supabase db reset`.
6. Run the app gap audit with `npm run audit:app`.
7. Link to the hosted project when you are ready:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"
supabase db push
```

## App gap audit

Run the built-in static audit before deployments:

```bash
npm run audit:app
```

The audit checks translation parity, PWA assets, permission wiring, PDF layout helpers, obvious client-side secret leaks, and hub contract JSON validity. Warnings are actionable cleanup items; errors should be fixed before shipping.

## App usage

The app is configured for the hosted Supabase project through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Google sign-in requires a Google Auth Platform web OAuth client and Supabase Google provider configuration:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_google_enabled": true,
    "external_google_client_id": "YOUR_GOOGLE_WEB_CLIENT_ID",
    "external_google_secret": "YOUR_GOOGLE_WEB_CLIENT_SECRET"
  }'
```

After signing in, create a company profile. The database trigger provisions owner membership, French account templates and VAT codes. The first usable flows are:

- Create invoices and line items.
- Attach a PDF/image source invoice during invoice creation.
- Scan invoice photos locally to prefill invoice fields.
- Add purchase records with VAT/category defaults.
- Upload receipt attachments to private Supabase Storage.
- Automatically post balanced journal entries for new invoices and purchases.
- Download invoice PDFs from the invoice register.
- Download tax analytics and financial report PDFs from Taxes and Reports.
- Generate service, booking, venue, event and equipment contracts from local templates.
- Send collaborator invite emails through the Cloudflare Pages Function at `/api/send-invite`.
- Push approval-request and `@mention` notification events to the hub through `/api/hub/notifications/push`.
- Send meeting invites with `.ics` calendar attachments through `/api/meeting-invites/send`.
- Add manual bank lines for later reconciliation.
- Review live dashboard totals and export readiness.

## Hub notifications

The hub contract declares:

- `notification_push_url`: app-owned bridge endpoint at `/api/hub/notifications/push`
- `hub_notification_target_url`: hub receiver at `https://hub.hinnoumusic.com/api/notifications/push`
- supported event types: `approval_requested`, `mention`, `meeting_invite`

When an approval is requested or a teammate is mentioned with `@email`, `@email-localpart`, `@all`, `@owner`, `@admin`, `@bookkeeper`, or `@viewer`, the app calls the bridge with the signed-in user token. The bridge verifies the requester, resolves recipients, normalizes one notification payload per recipient, signs the payload with `HUB_NOTIFICATION_SIGNING_SECRET` when configured, and forwards it to the hub. The summary feed also includes `recent_notifications` as an inbox/history fallback.

Meeting invites are delivered by Resend as normal email plus an attached `text/calendar` `.ics` request, so Google Calendar, Apple Calendar and Outlook can add the event without a proprietary calendar API. The same send path also forwards `meeting_invite` notifications to the hub for users who exist there.

Production notification delivery uses these Cloudflare Pages secrets:

```bash
npx wrangler pages secret put HUB_NOTIFICATION_PUSH_URL --project-name accounts-hinnoumusic
npx wrangler pages secret put HUB_NOTIFICATION_SIGNING_SECRET --project-name accounts-hinnoumusic
```

The public hub contract exposes only non-secret verification metadata: `signed`, `signature_algorithm`, `signature_header`, and `signature_key_id`.

## Hosted project

This workspace is prepared for Supabase project `zwcqecszstcmwpknyrqy`. The service role key and database password are intentionally not committed into the repo.

## Cloudflare deployment

The app is deployed to Cloudflare Pages project `accounts-hinnoumusic` and is bound to `https://accounts.hinnoumusic.com`.

Deploy the current build with:

```bash
CLOUDFLARE_ACCOUNT_ID=df69e83e67f7fe58c0bbd0421e4215b6 npx wrangler pages deploy dist --project-name accounts-hinnoumusic --branch main
```

Invite email delivery uses Resend from a Cloudflare Pages Function, so the API key must be stored as a Pages secret and never exposed to the browser:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name accounts-hinnoumusic
```

Optionally set `RESEND_FROM` to a verified sender address. If Resend rejects the send request, the UI falls back to a local `mailto:` invite link.

## Supabase keep-alive

Supabase Free projects can be paused after inactivity. This repo includes a low-cost heartbeat so the project receives real database activity every day. The recurring schedule currently runs from the existing Hinnou Hub Worker cron because the Cloudflare account is already at its cron-trigger limit.

- Migration: `supabase/migrations/20260512123000_keepalive_heartbeat.sql`
- Cron owner: `/Users/switchthemc/Projects/hinnou-hub`
- Manual check Worker: `workers/supabase-keepalive`

The scheduled job calls `public.keepalive_ping()` with the anon key only. It does not use the service role key and does not expose customer data.

The optional manual Worker can be deployed or updated with:

```bash
npm run keepalive:deploy
npx wrangler secret put SUPABASE_ANON_KEY --config workers/supabase-keepalive/wrangler.jsonc
```

## Design notes

- All business data is partitioned by `company_id`.
- Internal accounting stays double-entry even when the UI stays simplified.
- Journal entries are balanced with a deferred constraint trigger.
- Company creation auto-provisions default French accounts and VAT codes from seeded templates.
- RLS is enabled across tenant tables and uses company membership checks.
