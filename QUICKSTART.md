# DukiAI Memory - Quick Start Guide 🚀

## What You Have Now

Your DukiAI Memory monorepo is **fully scaffolded** with:

✅ **Mobile App** (React Native + Expo)  
✅ **Backend API** (Python FastAPI)  
✅ **Web App** (React + Vite - your design)  
✅ **Docker Services** (PostgreSQL, Redis, MinIO)  
✅ **Development Scripts** (One-command setup)

## 🏃 Quick Start (2 Steps)

### 1. Setup (First time only)

```bash
./scripts/setup.sh
```

This will:
- Install all dependencies (mobile, web, backend)
- Start Docker services (PostgreSQL, Redis, MinIO)
- Create Python virtual environment
- Set up configuration files

**Important:** After setup, add your OpenAI API key:

```bash
nano backend/.env
# Add: OPENAI_API_KEY=sk-your-key-here
```

### 2. Start Development

```bash
./scripts/dev.sh
```

This starts:
- 🔧 Backend API at http://localhost:8000
- 📱 Mobile app (Expo - scan QR code)
- 🐳 All Docker services

Press **Ctrl+C** to stop everything.

---

## 📱 Testing Your Setup

### Test Backend (Terminal)

```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

### Test Mobile (Simulator)

```bash
cd mobile
npm run ios  # Opens iOS simulator
```

Or scan the QR code with Expo Go app on your phone.

### Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | - |
| API Docs | http://localhost:8000/docs | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5432 | memoryai / dev_password_change_me |
| Redis | localhost:6379 | - |

---

## 📂 Project Structure

```
memory-ai/
├── mobile/              📱 React Native app (iOS + Android)
├── backend/             🔧 FastAPI backend
├── web/                 🌐 React web app (your design)
├── shared/              🔄 Shared TypeScript types
├── scripts/             ⚙️  Development scripts
├── docker-compose.yml   🐳 Local development services
└── package.json         📦 Monorepo root
```

---

## 🛠️ Development Workflow

### Working on Mobile

```bash
cd mobile
npm start

# Or use shortcuts from root:
npm run mobile       # Start Expo
npm run mobile:ios   # iOS simulator
```

### Working on Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Or from root:
npm run backend
```

### Working on Web

```bash
cd web
npm run dev

# Or from root:
npm run web
```

### Docker Management

```bash
npm run docker:up      # Start services
npm run docker:down    # Stop services
npm run docker:logs    # View logs
```

---

## 🎯 Next Implementation Steps

### Week 1: Backend Core

1. **Implement Authentication** ([backend/app/api/auth.py](backend/app/api/auth.py))
   - User registration with password hashing
   - JWT token generation
   - Token refresh logic

2. **Implement Memory CRUD** ([backend/app/api/memories.py](backend/app/api/memories.py))
   - Create, read, update, delete memories
   - Type filtering (text, link, voice)
   - Pagination

3. **File Upload** ([backend/app/api/storage.py](backend/app/api/storage.py))
   - Audio file upload to MinIO
   - Whisper transcription integration
   - File metadata storage

### Week 2: AI Integration

1. **OpenAI Service** (Create [backend/app/services/ai_service.py](backend/app/services/ai_service.py))
   ```python
   from openai import OpenAI
   from app.config import settings
   
   client = OpenAI(api_key=settings.OPENAI_API_KEY)
   
   def generate_summary(text: str) -> str:
       """Generate AI summary"""
       response = client.chat.completions.create(
           model=settings.OPENAI_MODEL,
           messages=[...]
       )
       return response.choices[0].message.content
   ```

2. **Vector Embeddings** (pgvector integration)
3. **Semantic Search Implementation**

### Week 3: Mobile Development

1. **Port Design Components**
   - HomeRecall → [mobile/app/(tabs)/recall.tsx](mobile/app/(tabs)/recall.tsx)
   - QuickCapture → [mobile/app/capture.tsx](mobile/app/capture.tsx)
   - UnifiedSearch → [mobile/app/(tabs)/archive.tsx](mobile/app/(tabs)/archive.tsx)

2. **API Integration**
   - Update [mobile/services/api.ts](mobile/services/api.ts) with real endpoints
   - Implement error handling
   - Add retry logic

3. **Audio Recording**
   ```typescript
   import { Audio } from 'expo-av';
   
   const recording = new Audio.Recording();
   await recording.prepareToRecordAsync();
   await recording.startAsync();
   // ... record ...
   await recording.stopAndUnloadAsync();
   const uri = recording.getURI();
   ```

### Week 4: Polish & Deploy

1. Testing & bug fixes
2. Performance optimization
3. Deploy backend (Railway/Render)
4. TestFlight build

---

## 📚 Useful Commands

### Database

```bash
# Connect to PostgreSQL
docker exec -it memory-ai-postgres psql -U memoryai -d memoryai

# Run migrations
cd backend
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

### Python

```bash
cd backend
source venv/bin/activate   # Activate venv
pip install <package>      # Install new package
pip freeze > requirements.txt  # Update requirements
```

### Mobile

```bash
cd mobile
npm install <package>      # Install package
npx expo install <package> # Install Expo SDK package
```

---

## 🐛 Troubleshooting

### "Module not found" in Mobile

```bash
cd mobile
rm -rf node_modules
npm install
npx expo start -c  # Clear cache
```

### Backend Not Starting

```bash
# Check if port 8000 is in use
lsof -ti:8000 | xargs kill -9

# Restart backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Docker Services Not Running

```bash
docker-compose down
docker-compose up -d
docker ps  # Check running containers
```

### Database Connection Issues

```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker logs memory-ai-postgres
```

---

## 📖 Documentation

- [TECHNICAL_PROPOSAL.md](TECHNICAL_PROPOSAL.md) - Complete architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed system design
- [DESIGN_REVIEW.md](DESIGN_REVIEW.md) - UI/UX analysis
- [GETTING_STARTED.md](GETTING_STARTED.md) - Detailed setup guide
- [mobile/README.md](mobile/README.md) - Mobile app docs
- [backend/README.md](backend/README.md) - Backend API docs

---

## 🆘 Get Help

### Check Service Status

```bash
# Backend
curl http://localhost:8000/health

# Database
docker exec -it memory-ai-postgres pg_isready -U memoryai

# Redis
docker exec -it memory-ai-redis redis-cli ping
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f minio
```

---

## 🎉 You're All Set!

Start coding:

```bash
./scripts/dev.sh
```

Open http://localhost:8000/docs to explore the API.

Press **'i'** in the Expo terminal to launch iOS simulator.

Happy coding! 🚀
