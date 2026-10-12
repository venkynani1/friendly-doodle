# Maverick Event Control Hub

Internal HR event tool: share a link, participants register and get a QR pass by email, desk staff scan entry / food / goodies, and HR watches live counts and downloads CSV reports.

It's one Next.js app (pages + API) on **Vercel** with **Neon Postgres**. There is no always-on server to fall asleep, so the first scan of the day is as fast as the rest.

## What it does

- **HR admins** create events, choose what gets scanned (entry, entry + food, or entry + food + goodies), set capacity and registration windows, and turn on walk-ins.
- Each event gets a **registration link** and, if walk-ins are on, a separate **walk-in link and printable QR**.
- **Participants** open the link (no sign-in), enter employee ID, name and email, and get a QR pass on screen **and by email** (QR image + token text + a link to reopen the pass).
- **Scanner operators** sign in on a phone or laptop, pick the event and counter, and scan with the camera or type the token. The screen turns green, amber (already scanned) or red, with a beep.
- **Live dashboard**: registered, checked in, not yet arrived, food, goodies, walk-ins, and a recent-activity feed. Refreshes every 5 seconds.
- **CSV export** per event: one row per participant with the time and desk of every scan.
- **Staff page**: add HR admins and scanner accounts, change passwords, deactivate accounts.

## Rules the app enforces

| Rule | How |
|---|---|
| One registration per employee ID, per email, and per device for each event | Database unique keys |
| Each pass is accepted once per counter | Database unique key on (pass, counter) — holds even when two desks scan the same QR at the same moment |
| Food and goodies only after entry | Checked on scan |
| Capacity covers registrations + walk-ins | Event row is locked while counting, so a burst of sign-ups can't overshoot |
| Registration only inside its window and while open; walk-ins only while enabled, open and before their close time | Checked on every sign-up |
| Scans only while the event is open for scanning, only for its enabled counters, and only for passes of the chosen event | Checked on scan |
| QR tokens are random 128-bit values | Can't be guessed or enumerated |

## Deploy (about 15 minutes)

### 1. Create the database on Neon

1. Sign up at [neon.tech](https://neon.tech) and create a project (pick the region closest to your users, e.g. Singapore for India).
2. On the project dashboard, open **Connect**. Copy two connection strings:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** (turn off connection pooling) → this is `DIRECT_URL`

### 2. Deploy on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub and **Import** this repository. Leave the root directory as the repo root; the framework is detected as Next.js.
2. Add these **Environment Variables** before the first deploy:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `SESSION_SECRET` | A long random string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `BOOTSTRAP_ADMIN_CODE` | Your HR login code, e.g. `HR001` |
| `BOOTSTRAP_ADMIN_PASSWORD` | A strong first password |
| `APP_URL` | Your site address, e.g. `https://maverick-events.vercel.app` (add after the first deploy if you don't know it yet, then redeploy) |
| `APP_TIMEZONE` | `Asia/Kolkata` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | See **Email** below |

3. Deploy. The build creates the database tables automatically (`vercel-build` runs `prisma db push`).
4. Open the site and sign in with `BOOTSTRAP_ADMIN_CODE` / `BOOTSTRAP_ADMIN_PASSWORD`. This creates the first HR admin. The bootstrap credentials stop working as soon as any account exists.
5. Go to **Staff** and create scanner accounts for your desk team.

### Email

Passes are emailed over SMTP. Without `SMTP_HOST`, registration still works and the email is written to the server log instead (shown as "Not sent (email off)" in the participants list).

Options that work well:

- **Gmail / Google Workspace**: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=` an [app password](https://myaccount.google.com/apppasswords) (needs 2-step verification).
- **Brevo, Resend, SendGrid, Mailgun** (good for higher volume): use the SMTP host, port and credentials from their dashboard; set `EMAIL_FROM` to an address on a domain you've verified with them.
- **Microsoft 365 / Outlook**: `smtp.office365.com`, port `587`, `SMTP_SECURE=false`. Many company tenants disable SMTP sign-in, so ask IT to enable SMTP AUTH for the sending mailbox or use one of the services above.

If an email fails, the participant still gets their pass on screen, and HR can press **Resend** next to them on the event page.

### Notes on free tiers

- Neon's free plan pauses the database when idle and resumes on the next request in well under a second.
- Vercel's free Hobby plan is meant for non-commercial use. For an official company tool, check with your company or use a Pro plan.

## Run locally

Requirements: Node.js 20+, and a Postgres database (a free Neon branch is easiest, or local Postgres).

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, SESSION_SECRET, bootstrap admin
npx prisma db push        # create tables
npm run dev               # http://localhost:3000
```

Camera scanning works on `localhost` and on HTTPS. On a phone, use the deployed HTTPS site.

Checks (the same ones GitHub Actions runs on every push):

```bash
npm run typecheck
npm run lint
npm run build
npm run start &           # then, in another terminal:
npm run smoke             # end-to-end test of the demo flow against the running app
```

## Demo script

1. Sign in as the HR admin. **New event** → choose **Entry + food + goodies**, set a capacity, a registration close time, and allow walk-ins.
2. On the event page, **Copy link** for registration. Open it in a private window and register. The pass appears and is emailed.
3. Back on the event page, press **Open for scanning**.
4. Sign in as a scanner (or press **Open scanner**). Pick **Entry**, scan the pass → green. Scan again → amber "Already scanned".
5. Pick **Food**, scan → green; again → amber. Pick **Goodies**, scan → green.
6. Open the walk-in link (or scan the walk-in QR), register, scan entry. The walk-in count goes up.
7. Watch the live counts on the event page, then **Download CSV**.

## Project layout

```
prisma/schema.prisma          Database model (events, registrations, scans, staff)
src/middleware.ts             Sends signed-out users to /login for /admin and /scanner
src/lib/                      Server logic: auth, events & registration, scanning, email, QR, CSV dates
src/app/api/                  JSON API (see below)
src/app/admin/                HR screens: events, event detail, reports, staff
src/app/scanner/              Desk scanner screen
src/app/register|walkin|pass  Public participant screens
src/components/               Shared UI
scripts/smoke-test.mjs        End-to-end test
.github/workflows/ci.yml      Type check, lint, build and end-to-end test on real Postgres
```

## API

All responses are JSON. Errors look like `{ "error": { "code": "ALREADY_SCANNED", "message": "...", "details": {...} } }`.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Staff | Session (http-only cookie, 12 h) |
| `GET /api/health` | Anyone | Health check incl. database |
| `GET /api/events` · `POST /api/events` | HR (scanners see open events) | List / create events |
| `GET · PUT · DELETE /api/events/{id}` | HR | Read / update / delete |
| `POST /api/events/{id}/actions` | HR | `{ action }`: `open`, `complete`, `reopen`, `registration-open`, `registration-close`, `registration-extend` (+`until`), `walkins-open`, `walkins-close`, `walkins-extend` (+`until`) |
| `GET /api/events/{id}/dashboard` | Staff | Live counts + recent activity |
| `GET /api/events/{id}/registrations?q=&source=` | HR | Participant list with scan times |
| `GET /api/events/{id}/export` | HR | CSV report |
| `GET /api/events/{id}/link-qr?type=registration\|walkin` | HR | QR image of the public link |
| `POST /api/registrations/{id}/resend` | HR | Re-send the pass email |
| `GET /api/public/events/{slug}` · `POST …/register` | Anyone | Normal registration |
| `GET /api/public/walkins/{slug}` · `POST …/register` | Anyone | Walk-in registration |
| `GET /api/public/pass/{token}` · `GET …/qr` | Pass holder | Pass details / QR image |
| `POST /api/scan/validate` | Staff | Look up a pass without recording |
| `POST /api/scan/stage` | Staff | `{ qrToken, stage, locationName, eventId }` → records the scan |
| `GET · POST /api/staff` · `PATCH /api/staff/{id}` | HR | Manage staff accounts |

## Later

- **Company SSO**: replace the password login in `src/app/api/auth/login` with an SSO callback that issues the same session cookie; map SSO groups to `HR_ADMIN` / `SCANNER_OPERATOR`. Nothing else needs to change.
- **Microsoft Graph email**: add a Graph sender next to the SMTP one in `src/lib/email.ts`.
