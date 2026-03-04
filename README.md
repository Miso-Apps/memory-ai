# Memory AI 🧠✨

> Your personal memory companion - Capture, recall, and reflect on everything happening in your daily life.

**All-in-one monorepo** with mobile app, backend API, and web interface.

---

## 🚀 Quick Start

```bash
# 1. Setup (first time only)
./scripts/setup.sh

# 2. Add your OpenAI API key to backend/.env
nano backend/.env

# 3. Start everything
./scripts/dev.sh
```

**That's it!** 🎉 Your backend, mobile app, and all services are running.

📚 **New here?** Start with [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

---

## 📁 Project Structure

```
memory-ai/
├── mobile/              📱 React Native app (iOS + Android)
├── backend/             🔧 FastAPI backend
├── web/                 🌐 React web app (design prototype)
├── shared/              🔄 Shared TypeScript types
├── scripts/             ⚙️  setup.sh, dev.sh
├── docker-compose.yml   🐳 PostgreSQL, Redis, MinIO
└── package.json         📦 Monorepo root
```

---

## ✅ What's Included

### Mobile App (React Native + Expo)
- ✅ File-based routing (Expo Router)
- ✅ Bottom tab navigation (Recall, Archive, Profile)
- ✅ API client with JWT auth
- ✅ State management (Zustand)
- ✅ Ready for iOS simulator

**Location:** [`mobile/`](./mobile/)

### Backend API (Python FastAPI)
- ✅ REST API with async support
- ✅ PostgreSQL + pgvector for embeddings
- ✅ JWT authentication
- ✅ OpenAI integration ready
- ✅ File upload (S3/MinIO)
- ✅ API docs at `/docs`

**Location:** [`backend/`](./backend/)

### Web App (React + Vite)
- ✅ Complete UI/UX design prototype
- ✅ Multi-modal capture (text, links, voice)
- ✅ AI-powered recall interface
- ✅ Beautiful animations

**Location:** [`web/`](./web/)

### Infrastructure
- ✅ Docker Compose (PostgreSQL, Redis, MinIO)
- ✅ One-command setup script
- ✅ One-command dev environment
- ✅ Environment configuration

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native, Expo, TypeScript, Zustand |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **AI** | OpenAI GPT-4, Whisper, text-embedding-3-large |
| **Web** | React 18, Vite 6, Tailwind CSS, Radix UI |

---

## 🎯 Development Status

| Component | Status | Description |
|-----------|--------|-------------|
| **Project Setup** | ✅ Complete | Monorepo structure, scripts, configs |
| **Design Prototype** | ✅ Complete | Beautiful UI/UX in `/web` |
| **Mobile Scaffold** | ✅ Complete | Navigation, API client, auth |
| **Backend Scaffold** | ✅ Complete | Endpoints, models, config |
| **Docker Services** | ✅ Complete | PostgreSQL, Redis, MinIO |
| **Auth Implementation** | 🔄 Next | JWT, user registration |
| **Memory CRUD** | 🔄 Next | Create, read, update, delete |
| **AI Integration** | 🔄 Next | OpenAI, embeddings, search |
| **Audio Upload** | 🔄 Next | Whisper transcription |
| **Production Deploy** | ⏳ Later | Railway/Render + TestFlight |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [**QUICKSTART.md**](./QUICKSTART.md) | 🚀 Start here! Quick setup guide |
| [TECHNICAL_PROPOSAL.md](./TECHNICAL_PROPOSAL.md) | Complete system architecture |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailed design & data flows |
| [DESIGN_REVIEW.md](./DESIGN_REVIEW.md) | UI/UX analysis (Grade: A+) |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Detailed implementation guide |
| [mobile/README.md](./mobile/README.md) | Mobile app documentation |
| [backend/README.md](./backend/README.md) | Backend API documentation |

---

## 🔗 Service URLs (when running)

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | - |
| API Docs | http://localhost:8000/docs | Interactive Swagger UI |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5432 | memoryai / dev_password_change_me |

---

## 💡 Common Commands

```bash
# Setup (first time)
./scripts/setup.sh

# Start development environment
./scripts/dev.sh

# Or start individually:
npm run mobile          # Start mobile app
npm run backend         # Start backend API
npm run web             # Start web app
npm run docker:up       # Start Docker services
```

---

## 🎓 Next Steps

1. ✅ **Setup complete** - You've scaffolded the full stack!
2. 📝 **Add OpenAI API key** to `backend/.env`
3. 🔧 **Implement auth** in `backend/app/api/auth.py`
4. 📱 **Port UI components** from `web/` to `mobile/`
5. 🤖 **Integrate AI features** (summarization, recall, search)
6. 🚀 **Deploy** to production

See [QUICKSTART.md](./QUICKSTART.md) for detailed implementation guidance.

---

## 🐛 Troubleshooting

**Docker services not starting?**
```bash
docker-compose down
docker-compose up -d
```

**Mobile app not loading?**
```bash
cd mobile && npx expo start -c
```

**Backend errors?**
```bash
cd backend && source venv/bin/activate
pip install -r requirements.txt
```

More help: [QUICKSTART.md#troubleshooting](./QUICKSTART.md#-troubleshooting)

---

## 📄 License

Private project - All rights reserved

---

**Ready to build?** → [QUICKSTART.md](./QUICKSTART.md) 🚀