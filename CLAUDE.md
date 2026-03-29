# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Memory AI is a personal memory companion app — multi-platform monorepo with:
- **`backend/`** — Python FastAPI REST API
- **`mobile/`** — React Native + Expo (iOS/Android)
- **`web/`** — React + Vite design prototype
- **`extension/`** — Chrome extension (Manifest V3)
- **`landing/`** — Static HTML marketing page
- **`deployment/`** — DigitalOcean + Docker production config
- **`scripts/`** — Dev/setup automation

## Common Commands

### Start Everything
```bash
./scripts/dev.sh                  # Backend + Docker services
./scripts/dev.sh --ios            # + iOS simulator
./scripts/dev.sh --android        # + Android emulator
./scripts/dev.sh --web            # + Web app instead of mobile
./scripts/dev.sh --backend-only   # Backend + Docker only
```

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload     # Dev server at http://localhost:8000
pytest                            # Run all tests
pytest tests/test_memories.py     # Run single test file
pytest -k "test_create"           # Run tests matching pattern
alembic upgrade head              # Apply migrations
alembic revision --autogenerate -m "description"  # New migration
```

### Mobile (React Native + Expo)
```bash
cd mobile
npm start                         # Start Expo dev server
npm run ios                       # iOS simulator
npm run android                   # Android emulator
npm test                          # Run tests
npm run test:watch                # Watch mode
npm run type-check                # TypeScript check
npm run lint
eas build --platform ios          # Production build
```

### Web (React + Vite)
```bash
cd web
npm run dev                       # Dev server at http://localhost:5173
npm run build                     # Production build to dist/
```

### Docker Services (PostgreSQL, Redis, MinIO)
```bash
docker-compose up -d
docker-compose down
docker exec -it memory-ai-postgres psql -U memoryai -d memoryai
```

### Root monorepo shortcuts
```bash
npm run backend
npm run mobile
npm run web
npm run docker:up / docker:down / docker:logs
```

## Architecture

### Backend Structure
```
backend/app/
├── main.py              # FastAPI app setup, route mounting, CORS
├── config.py            # Pydantic BaseSettings (reads .env)
├── database.py          # Async PostgreSQL session factory (asyncpg)
├── api/                 # Route handlers (auth, memories, ai, storage, categories, preferences, insights, decisions)
├── services/
│   ├── ai_service.py           # OpenAI: summarization, embeddings, Whisper transcription
│   ├── link_service.py         # URL metadata extraction, YouTube transcripts (trafilatura)
│   ├── storage_service.py      # S3/MinIO file operations
│   └── media_optimizer.py      # Image compression (Pillow)
├── models/              # SQLAlchemy ORM models
└── schemas/             # Pydantic request/response schemas
```

### Mobile Structure
```
mobile/app/
├── _layout.tsx          # Root layout, navigation setup
├── (tabs)/              # Tab screens: recall (home), archive, insights, profile
├── capture.tsx          # Quick capture modal (text/voice/link/photo)
├── memory/[id].tsx      # Memory detail view
├── decisions.tsx        # Decision replay interface
└── login.tsx            # Auth screen
mobile/
├── services/api.ts      # Axios API client with JWT auth
├── store/authStore.ts   # Zustand auth state
└── store/settingsStore.ts
```

### Key Data Models
- **Memory** — `type` ∈ {TEXT, VOICE, LINK, PHOTO}; has `embedding` (pgvector, 1536-dim OpenAI); optional `audio_url`, `image_url`, `ai_summary`, `category_id`
- **User** — UUID PK, email/password auth with JWT
- **Category** — per-user, with system categories
- **UserPreferences** — theme, recall sensitivity, notification settings, proactive recall opt-in
- **RadarEvent** — proactive recall suggestions with confidence score
- **DecisionMemory** — decision tracking with outcomes and reflections
- **MemoryLink** — enriched link metadata attached to memories

### Vector Search
Memories store OpenAI `text-embedding-3-large` embeddings (1536-dim) in PostgreSQL via pgvector. Semantic search uses cosine distance (`<->`). Pinecone can be used as an alternative (configured via env vars).

### Authentication
JWT-based. Tokens in `Authorization: Bearer` header. Mobile stores tokens in Zustand (AsyncStorage persistence). Backend uses `python-jose` + `bcrypt`.

### AI Pipeline (per memory)
1. Audio → Whisper transcription → `content` field
2. Content → `text-embedding-3-large` → `embedding` column
3. Content → GPT-4o mini → `ai_summary` field
4. Content → GPT-4o → category auto-assignment

## Environment Configuration

### Backend (`backend/.env`)
Key variables: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `JWT_SECRET_KEY`, `S3_ENDPOINT_URL` (MinIO), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`. See `backend/.env.example` for all options.

### Web (`web/.env`)
`VITE_API_BASE_URL` — backend URL (defaults to `http://localhost:8000`)

## Production Deployment (DigitalOcean)
```bash
cd deployment
./deploy.sh --init   # First-time: provisions SSL, sets up all services
./deploy.sh          # Subsequent deploys
```
Stack: Nginx (reverse proxy + SSL) → FastAPI → PostgreSQL + Redis + MinIO (Docker). Landing page auto-deploys via Netlify on push to main.

## Extension Development
Load unpacked from `/extension` in `chrome://extensions` with Developer mode. No build step. Background service worker in `background.js`, content script in `content.js`, shared API client in `api.js` (has offline queue).

## Development Guidelines

Follow these rules on every task in this repository:

### 1. Use Available Skills and Agents
Before implementing, check available Claude Code skills (via the Skill tool) and agent types that may support the task — e.g., `frontend-design`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `pr-review-toolkit:code-reviewer`. Use them rather than reimplementing their purpose.

### 2. Validate and Test All Changes
All changes must be validated before marking complete:
- **Backend**: run `pytest` from `backend/` (activate venv first)
- **Mobile**: run `npm run type-check && npm run lint` from `mobile/`
- **Web**: run `npm run build` from `web/` to catch type/build errors
- Use the `superpowers:verification-before-completion` skill before claiming work is done.

### 3. Python Backend Virtual Environment
Always activate the backend venv before running Python commands:
```bash
source backend/venv/bin/activate
```
Never install packages globally. Use `pip install -r backend/requirements.txt` inside the venv.

### 4. i18n: Vietnamese and English Required
All user-facing strings in mobile must have translations in **both** locales:
- `mobile/i18n/locales/en.ts` — English
- `mobile/i18n/locales/vi.ts` — Vietnamese

Run `npm run i18n:check` from `mobile/` to verify parity after any string changes.

### 5. Check for Database Migrations
When any SQLAlchemy model in `backend/app/models/` is added or changed, check whether a migration is needed:
```bash
source backend/venv/bin/activate
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```
Review the generated migration before applying; autogenerate is not always perfect.

### 6. Check Deployment Steps
When backend models, environment variables, API routes, or infrastructure change, review `deployment/README.md` and `deployment/deploy.sh` to determine if deployment steps need updating. Update `backend/.env.example` for any new env vars.

### 7. Web UI Changes Require Webapp Testing
After any change to `web/src/`, run webapp tests using the `pr-review-toolkit:pr-test-analyzer` skill or use the Playwright MCP tools to verify the affected UI flows work correctly in the browser.