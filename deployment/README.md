# Memory AI — DigitalOcean Deployment Guide

Full production deployment for the Memory AI backend stack on DigitalOcean.

## Architecture

```
Client (iOS / Android / Chrome Extension / Web)
    │
    ▼ HTTPS 443
┌─────────────────────────────────────────────────┐
│  DigitalOcean Droplet  (Ubuntu 22.04, 4 GB RAM) │
│                                                 │
│   Nginx (SSL termination + reverse proxy)       │
│       │                                         │
│       ▼                                         │
│   FastAPI  ──► PostgreSQL + pgvector            │
│       │    ──► Redis (cache / sessions)         │
│       │    ──► MinIO (object storage)           │
│       │    ──► OpenAI API (external)            │
│                                                 │
│   Certbot  (Let's Encrypt auto-renew)           │
└─────────────────────────────────────────────────┘
```

**Stack versions**
| Service    | Image                  | Notes                            |
| ---------- | ---------------------- | -------------------------------- |
| FastAPI    | python:3.11-slim       | uvicorn + uvloop + httptools     |
| Nginx      | nginx:1.25-alpine      | SSL termination, rate limiting   |
| PostgreSQL | pgvector/pgvector:pg16 | pgvector extension pre-installed |
| Redis      | redis:7-alpine         | LRU cache, 256 MB limit          |
| MinIO      | minio/minio:latest     | S3-compatible object storage     |
| Certbot    | certbot/certbot:latest | Let's Encrypt, auto-renews       |

---

## 1. Create a DigitalOcean Droplet

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com/) → **Droplets → Create**.
2. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic, **$24/mo (4 GB RAM, 2 vCPU, 80 GB SSD)** (minimum recommended)
   - **Datacenter**: Choose region closest to your users
   - **Authentication**: SSH Key (add your public key)
3. Click **Create Droplet**.
4. Note the **Droplet IP** (e.g. `104.248.x.x`).

---

## 2. Point your domain to the Droplet

Create a DNS **A record** with your registrar or DigitalOcean DNS:

```
api.dukiai.com  →  A  →  <Droplet IP>
```

Wait for propagation (~5 min), verify with:
```bash
dig +short api.dukiai.com
```

---

## 3. Set up the server

SSH in and run the bootstrap script:

```bash
ssh root@<Droplet IP>

# Install Docker & Docker Compose v2
apt-get update && apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## 4. Clone the repository & configure

```bash
git clone https://github.com/your-org/memory-ai.git /opt/memory-ai
cd /opt/memory-ai/deployment

# Create .env from the example
cp .env.example .env

# Generate SECRET_KEY
openssl rand -hex 32

# Edit .env with your values
nano .env
```

**Required values to set in `.env`:**
| Variable              | How to get it                                       |
| --------------------- | --------------------------------------------------- |
| `DOMAIN`              | Your API subdomain (`api.dukiai.com`)               |
| `SECRET_KEY`          | `openssl rand -hex 32`                              |
| `POSTGRES_PASSWORD`   | Choose a strong password                            |
| `REDIS_PASSWORD`      | Choose a strong password                            |
| `MINIO_ROOT_PASSWORD` | Choose a strong password                            |
| `OPENAI_API_KEY`      | [platform.openai.com](https://platform.openai.com/) |

---

## 5. Open firewall ports

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (ACME challenge + redirect)
ufw allow 443/tcp   # HTTPS
ufw enable
```

> **MinIO console** (port 9001) is NOT opened publicly. Use an SSH tunnel:
> ```bash
> ssh -L 9001:localhost:9001 root@<Droplet IP>
> # Then visit http://localhost:9001 in your browser
> ```

---

## 6. First-time deploy

```bash
chmod +x /opt/memory-ai/deployment/deploy.sh
cd /opt/memory-ai/deployment

# --init: obtains SSL cert, runs migrations, creates MinIO bucket
./deploy.sh --init
```

The script will:
1. Start Nginx on port 80 for the ACME challenge
2. Request an SSL cert from Let's Encrypt
3. Start and health-check PostgreSQL
4. Run database migrations (`migrate.py`)
5. Start MinIO and create the `memories` bucket
6. Bring up the full stack (`docker compose up -d`)

> **⚠️ SSL Bootstrap Issue** — If Nginx crashes on first run with
> `cannot load certificate … fullchain.pem: No such file or directory`,
> the cert doesn't exist yet and Nginx can't start to serve the ACME challenge.
> Fix with the standalone method (see **Troubleshooting → SSL cert not found** below).

Verify everything is running:
```bash
docker compose -f docker-compose.prod.yml ps
curl https://api.dukiai.com/health
```

## 6.1 Radar schema updates (2026-03)

The current migration flow now includes Memory Radar schema additions.

Applied by `backend/migrate.py` during deploy:
- `user_preferences.recall_sensitivity` (default: `medium`)
- `user_preferences.proactive_recall_opt_in` (default: `true`)
- `radar_events` table + indexes (`user_id`, `memory_id`, `event_type`, `created_at`)

Fresh database bootstrap parity:
- `backend/init-db.sql` also contains these columns/table so first-time DB init and upgrades stay aligned.

Smoke-check after deploy:
```bash
curl -H "Authorization: Bearer <token>" "https://api.dukiai.com/ai/radar?limit=3"
```

---

## 7. Subsequent deploys

After code changes, simply run:
```bash
cd /opt/memory-ai
git pull
./deployment/deploy.sh
```

This pulls, rebuilds the API image, runs migrations, and reloads Nginx.

---

## 8. SSL renewal

Certbot runs inside Docker and auto-renews every 12 hours. To force a renewal:
```bash
docker compose -f docker-compose.prod.yml exec certbot \
    certbot renew --webroot -w /var/www/certbot --quiet
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 9. Backups

### PostgreSQL backup
```bash
docker compose -f /opt/memory-ai/deployment/docker-compose.prod.yml exec -T postgres \
    pg_dump -U memoryai memoryai | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

Set up a daily cron:
```bash
crontab -e
# Add:
0 3 * * * cd /opt/memory-ai/deployment && docker compose exec -T postgres \
    pg_dump -U memoryai memoryai | gzip > /opt/backups/db_$(date +\%Y\%m\%d).sql.gz
```

### MinIO backup (to DigitalOcean Spaces)
```bash
# Install mc inside the MinIO container and mirror to DO Spaces
docker compose -f docker-compose.prod.yml exec minio \
    mc mirror /data s3/your-do-spaces-bucket/minio-backup/
```

---

## 10. Monitoring & Logs

```bash
# All service logs (follow)
docker compose -f docker-compose.prod.yml logs -f

# API logs only
docker compose -f docker-compose.prod.yml logs -f api

# Resource usage
docker stats

# Disk usage
df -h
docker system df
```

---

---

## iOS App Deployment (App Store)

The mobile app is built with **Expo SDK 51** (React Native 0.74). Releases go through
**EAS Build** (cloud build service) → **TestFlight** → **App Store review**.

### Prerequisites

| Requirement             | Details                                                        |
| ----------------------- | -------------------------------------------------------------- |
| Apple Developer account | [developer.apple.com](https://developer.apple.com/) — $99/year |
| Xcode 15+               | Mac only — install from the Mac App Store                      |
| EAS CLI                 | `npm install -g eas-cli`                                       |
| Expo account            | Free — [expo.dev](https://expo.dev/)                           |

### 11a. One-time setup

```bash
# 1. Log in to Expo
eas login

# 2. Link the project to your Expo account
cd mobile
eas init --id YOUR_EXPO_PROJECT_ID
# (or let EAS create a new project — it will update app.json)
```

**Fill in `mobile/eas.json`** with your real values:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@example.com",      // Your Apple ID
      "ascAppId": "1234567890",          // App Store Connect → App → Apple ID
      "appleTeamId": "ABCDEF1234"        // developer.apple.com → Membership
    }
  }
}
```

**Create the app in App Store Connect** (if not done yet):
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com/) → **My Apps → +**.
2. Bundle ID: `com.dukiai.app`, Name: **Memory AI**, Primary language.
3. Save — note the **Apple ID** number (10 digits).

**Set the API base URL** in `mobile/services/api.ts`:
```ts
const BASE_URL = "https://api.dukiai.com";   // your DO Droplet URL
```

### 11b. Build for TestFlight (internal testing)

EAS builds the IPA in the cloud — no local Mac required for non-simulator builds.

```bash
cd mobile

# Install dependencies first
npm install

# Build a production IPA and upload directly to TestFlight
eas build --platform ios --profile production

# When prompted:
#   "Generate a new Apple Distribution Certificate?" → Y (first time)
#   "Generate a new provisioning profile?" → Y (first time)
# EAS stores credentials securely in its vault.
```

This typically takes **10–20 minutes**. Monitor at [expo.dev/accounts/YOUR_ACCOUNT/builds](https://expo.dev/).

Once the build is finished, submit it to TestFlight:

```bash
eas submit --platform ios --profile production --latest
```

Or combine build + submit in one command:

```bash
eas build --platform ios --profile production --auto-submit
```

### 11c. TestFlight testing

1. Open **App Store Connect → TestFlight → Builds**.
2. Wait for Apple's automated review (~15–30 min).
3. Add **internal testers** (up to 100, no review needed) or create a **public TestFlight link**.
4. Testers install via the TestFlight app on iPhone/iPad.

### 11d. Submit to the App Store

When you're ready to release publicly:

1. In App Store Connect, go to **My Apps → Memory AI → + Version**.
2. Select the TestFlight build you tested.
3. Fill in: **What's New**, screenshots (6.7" + 5.5" required), description, keywords, category.
4. Submit for Review — typical review time is **24–48 hours**.

### 11e. Over-the-air JS updates (no App Store review)

For JavaScript-only changes (UI tweaks, bug fixes that don't touch native modules), use
**EAS Update** to push instantly without a new App Store release:

```bash
# Publish an update to the "production" channel
eas update --channel production --message "Fix chat scroll bug"
```

Users on that channel receive the update automatically on next app launch.

> **Limitation**: Native code changes (new Expo plugins, new permissions, upgrading `expo` SDK version) always require a new full build and App Store submission.

### 11f. Build versions

`eas.json` has `"autoIncrement": true` for production — EAS automatically bumps the
`buildNumber` each time. The user-facing `version` in `app.json` should be updated manually
before shipping a major release:

```bash
# e.g. bump to 1.1.0
# Edit mobile/app.json: "version": "1.1.0"
eas build --platform ios --profile production --auto-submit
```

### 11g. Environment variables for the build

Sensitive values (API URL, keys) should be added as **EAS secrets**, not committed to git:

```bash
eas secret:create --scope project --name API_BASE_URL --value https://api.dukiai.com
eas secret:create --scope project --name GOOGLE_CLIENT_ID --value 382213094350-...
```

Reference them in `app.config.js` (rename `app.json` → `app.config.js` to use `process.env`):
```js
export default {
  expo: {
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    },
  },
};
```

### Quick reference

```bash
# Development build (runs on a physical device via Expo Go alternative)
eas build --platform ios --profile development

# Simulator build (no Apple account needed)
eas build --platform ios --profile development --local

# Check current builds
eas build:list --platform ios

# Check submission status
eas submission:list --platform ios
```

---

## Landing Page Deployment (Netlify)

The landing page (`landing/`) is a pure-HTML static site. **Netlify** is the recommended host:
free tier, global CDN, HTTPS, and auto-deploys on every `git push` — no server needed.

### 12a. One-time setup

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. Go to [app.netlify.com](https://app.netlify.com/) → **Add new site → Import an existing project**.
3. Select your repo.
4. Netlify reads `netlify.toml` automatically — no manual settings needed:
   - **Publish directory**: `landing`
   - **Build command**: *(none — it's plain HTML)*
5. Click **Deploy site** — done. Netlify gives you a URL like `memory-ai.netlify.app`.

### 12b. Custom domain

1. In Netlify → **Domain settings → Add custom domain** → enter `dukiai.com`.
2. Point your DNS to Netlify's nameservers (or add a CNAME record).
3. Netlify provisions an SSL cert via Let's Encrypt automatically.

### 12c. Update store links when apps go live

All download/install buttons in the landing page read from a single JS config block.
Open `landing/index.html`, find the `STORE_URLS` object near the bottom, and fill in the real URLs:

```js
const STORE_URLS = {
  appStore:    'https://apps.apple.com/app/memory-ai/idXXXXXXXXX',   // App Store Connect → App → Apple ID
  googlePlay:  'https://play.google.com/store/apps/details?id=com.dukiai.app',
  chromeStore: 'https://chromewebstore.google.com/detail/memory-ai/EXTENSION_ID',
  webApp:      'https://app.dukiai.com',
};
```

Commit and push — Netlify auto-deploys in ~30 seconds.

### 12d. Preview deploys

Every pull request automatically gets a unique preview URL
(`https://deploy-preview-42--memory-ai.netlify.app`). Share with teammates for review before merging.

---

## Chrome Extension Deployment (Chrome Web Store)

### 13a. Pack the extension

```bash
cd extension

# Zip everything except dev/test files
zip -r ../memory-ai-extension-v1.0.0.zip . \
  --exclude "*.py" --exclude "*.md" --exclude ".DS_Store"
```

### 13b. Create a Chrome Web Store developer account

1. Go to [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole).
2. Pay the one-time **$5 registration fee**.
3. Verify your developer email.

### 13c. Publish the extension

1. Click **New Item → Upload** and select the `.zip`.
2. Fill in:
   - **Name**: Memory AI
   - **Short description**: Capture any thought, link, or selection to your Memory AI second brain — one keystroke.
   - **Detailed description**: (use the `extension/README.md` as a base)
   - **Category**: Productivity
   - **Screenshots**: at least 1 × 1280×800 or 640×400 image of the popup
   - **Privacy policy URL**: `https://dukiai.com/privacy`
   - **Single purpose**: "Save web content to Memory AI"
3. Under **Permissions**, justify each permission in the form:
   - `storage` — save user preferences and offline queue locally
   - `tabs` — read current tab URL/title when the user saves a link
   - `activeTab` — access page content only when user triggers a keyboard shortcut
   - `contextMenus` — right-click menu to save selections
   - `notifications` — confirm saves with a brief toast
4. Click **Submit for Review** — typical review: **3–7 business days** for new items.

### 13d. Get the Extension ID

After the item is created (even before review completes), the URL contains the permanent ID:

```
https://chromewebstore.google.com/detail/memory-ai/abcdefghijklmnopqrstuvwxyz123456
                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                     this is your EXTENSION_ID
```

Copy it into `STORE_URLS.chromeStore` in `landing/index.html` and commit.

### 13e. Publish updates

```bash
# Bump version in extension/manifest.json: "version": "1.0.1"
zip -r ../memory-ai-extension-v1.0.1.zip extension/ --exclude "*.py" --exclude "*.md"
# Upload new zip in Chrome Web Store developer console → Package tab → Upload new package
# Click "Submit for Review" — updates review in 1–3 days (faster than initial review)
```

---

## Scaling Options

| Need                          | Solution                                                 |
| ----------------------------- | -------------------------------------------------------- |
| More API throughput           | Increase `--workers` in Dockerfile CMD (max = 2×CPU + 1) |
| Bigger DB                     | Migrate to DO Managed PostgreSQL (pgvector supported)    |
| Object storage reliability    | Switch MinIO → DigitalOcean Spaces (S3-compatible)       |
| Zero-downtime deploys         | Add a second Droplet behind a DO Load Balancer           |
| Background tasks              | Add Celery worker service + beat scheduler               |
| CDN for landing page / assets | DO CDN + Spaces, or Cloudflare free tier                 |

---

## Troubleshooting

**API returns 502 Bad Gateway**
```bash
docker compose logs api   # Check for startup errors
docker compose restart api
```

**SSL cert not found / `fullchain.pem: No such file or directory`**

This happens on first deploy because Nginx tries to load the SSL cert before it exists.
Use Certbot in standalone mode (it runs its own temporary HTTP server on port 80):
```bash
cd /opt/memory-ai/deployment

# 1. Stop nginx so port 80 is free
docker compose -f docker-compose.prod.yml stop nginx

# 2. Find the certbot volume names
docker volume ls | grep certbot
# Example output:
#   deployment_certbot_conf
#   deployment_certbot_www

# 3. Run certbot standalone to obtain the cert
docker run --rm \
  -v deployment_certbot_conf:/etc/letsencrypt \
  -v deployment_certbot_www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d api.dukiai.com \
  --email admin@dukiai.com \
  --agree-tos --no-eff-email

# 4. Start nginx — the cert now exists, it will start cleanly
docker compose -f docker-compose.prod.yml up -d nginx

# 5. Verify
docker compose -f docker-compose.prod.yml logs --tail=10 nginx
curl https://api.dukiai.com/health
```

> Replace `deployment_certbot_conf` / `deployment_certbot_www` with the actual
> volume names returned by `docker volume ls` if they differ.

**`unknown "domain" variable` in Nginx logs**

Nginx does not expand shell environment variables. The `nginx.conf` must use
the literal domain name, not `${DOMAIN}`. This was fixed by hardcoding
`api.dukiai.com` directly in `deployment/nginx/nginx.conf`. If you see this
error after pulling an older version:
```bash
# Confirm the fix is in place
grep 'server_name' deployment/nginx/nginx.conf
# Should show: server_name api.dukiai.com;
```

**`"listen ... http2" directive is deprecated` warning**

Nginx 1.25+ removed the `listen 443 ssl http2` syntax. The correct form is:
```nginx
listen 443 ssl;
http2 on;
```
This is already fixed in `deployment/nginx/nginx.conf`. Restart nginx to apply:
```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate nginx
```

**Database connection refused**
```bash
docker compose exec -T postgres pg_isready -U memoryai
docker compose logs postgres
```

**MinIO bucket missing**
```bash
# Access MinIO console via SSH tunnel (see step 6)
# Or create via mc:
docker compose exec minio mc mb local/memories
```
