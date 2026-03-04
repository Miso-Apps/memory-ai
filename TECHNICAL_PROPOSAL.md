# Memory AI - Technical Proposal & Architecture

## 📋 Design Review Summary

### Current Design (in `/design` folder)
Your Figma-exported design prototype is a **beautiful, well-thought-out React/TypeScript/Vite application** with the following features:

#### ✅ Core Features Implemented in Design:
1. **Quick Capture** - Multi-modal capturing (text, links, voice)
   - Smart clipboard detection (auto-detects URLs vs text)
   - Voice recording interface
   - Link saving with preview
   - Text note capture

2. **HomeRecall** - AI-powered memory recall
   - Contextual reminders of past memories
   - AI-generated summaries
   - Smart suggestions based on recent thoughts

3. **Archive/Search (UnifiedSearchScreen)** - Complete memory search
   - Tab-based filtering (text, links, voice)
   - AI-powered semantic search
   - Organized memory browsing

4. **Memory Detail View** - Rich memory inspection
   - AI summary vs original content toggle
   - Reflection prompts ("What do you think now?")
   - Context about why you saved it

5. **Profile & Settings** - User management

6. **Onboarding (WelcomeScreen)** - Beautiful 3-step introduction

#### 🎨 Design Quality:
- **Mobile-first** with safe area handling (iOS notch/gesture bar)
- **Smooth animations** using Motion (Framer Motion)
- **Modern UI** with Radix UI components
- **Tailwind CSS** for styling
- **Vietnamese language** support
- **Dark/Light mode** ready (uses next-themes)

---

## 🏗️ Recommended Tech Stack for Full Implementation

### Option 1: React Native (Recommended) ⭐
**Best for your skillset** - You already have React/TypeScript experience!

```
├── mobile/              # React Native (iOS + Android)
├── backend/             # Python (FastAPI)
├── web/                 # React/Vite (your current design)
└── shared/              # Shared types, utilities
```

**Pros:**
- ✅ Reuse your existing React components (~80% code reuse)
- ✅ You already know TypeScript/React
- ✅ Single codebase for iOS + Android
- ✅ Expo offers great developer experience
- ✅ Can share business logic between web and mobile
- ✅ Hot reload, fast development

**Cons:**
- ❌ Slightly different from native iOS feel (but close!)
- ❌ May need native modules for advanced features

### Option 2: Native iOS (Swift/SwiftUI)
```
├── ios/                 # Swift/SwiftUI
├── backend/             # Python (FastAPI)
└── web/                 # React/Vite
```

**Pros:**
- ✅ Best iOS performance and native feel
- ✅ Full access to iOS APIs
- ✅ Xcode simulator as you wanted

**Cons:**
- ❌ Must learn Swift/SwiftUI (different paradigm)
- ❌ Cannot reuse your React components
- ❌ iOS only (need separate Android app later)
- ❌ Longer development time

---

## 🎯 Proposed Monorepo Structure (React Native)

```
memory-ai/
│
├── .github/workflows/        # CI/CD
│   ├── mobile.yml
│   ├── backend.yml
│   └── web.yml
│
├── mobile/                   # React Native (Expo)
│   ├── app/                  # Expo Router (file-based routing)
│   │   ├── (tabs)/          # Bottom tab navigation
│   │   │   ├── recall.tsx   # HomeRecall screen
│   │   │   ├── archive.tsx  # Search/Archive
│   │   │   └── profile.tsx  # Profile
│   │   ├── memory/
│   │   │   └── [id].tsx     # Memory detail
│   │   ├── capture.tsx      # Quick capture modal
│   │   └── _layout.tsx      # Root layout
│   ├── components/          # Shared components
│   ├── hooks/              # Custom hooks
│   ├── services/           # API client
│   ├── store/              # State management (Zustand)
│   ├── types/              # TypeScript types
│   ├── app.json            # Expo config
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                 # Python FastAPI
│   ├── app/
│   │   ├── main.py         # FastAPI app
│   │   ├── config.py       # Settings
│   │   ├── database.py     # DB connection
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── api/
│   │   │   ├── auth.py     # Authentication
│   │   │   ├── memories.py # CRUD for memories
│   │   │   ├── ai.py       # AI/ML endpoints
│   │   │   └── storage.py  # File upload/download
│   │   ├── services/
│   │   │   ├── ai_service.py      # OpenAI/Anthropic integration
│   │   │   ├── storage_service.py # S3/local storage
│   │   │   ├── search_service.py  # Vector search (Pinecone/local)
│   │   │   └── audio_service.py   # Whisper transcription
│   │   └── utils/
│   ├── alembic/            # DB migrations
│   ├── tests/
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
│
├── web/                     # React/Vite (your design folder)
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── styles/
│   ├── package.json
│   └── vite.config.ts
│
├── shared/                  # Shared code
│   ├── types/              # TypeScript types used by web+mobile
│   └── constants/
│
├── docs/                    # Documentation
│   ├── API.md              # API documentation
│   ├── SETUP.md            # Setup guide
│   └── DEPLOYMENT.md       # Deployment guide
│
├── scripts/                 # Utility scripts
│   ├── setup.sh            # One-command setup
│   └── dev.sh              # Start all services
│
├── docker-compose.yml       # Local development
├── .gitignore
├── README.md
├── TECHNICAL_PROPOSAL.md   # This file
└── package.json            # Root package.json (workspaces)
```

---

## 🛠️ Detailed Tech Stack

### Mobile (React Native + Expo)
```json
{
  "expo": "~51.0.0",
  "react-native": "0.74.x",
  "expo-router": "~3.5.0",        // File-based routing
  "expo-av": "~14.0.0",           // Audio recording/playback
  "expo-file-system": "~17.0.0",  // File management
  "expo-clipboard": "~6.0.0",     // Clipboard access
  "expo-haptics": "~13.0.0",      // Haptic feedback
  "expo-camera": "~15.0.0",       // Camera/screenshot
  "@react-native-async-storage/async-storage": "1.23.1",
  "zustand": "^4.5.0",            // State management
  "react-query": "^5.0.0",        // API data fetching
  "axios": "^1.6.0",              // HTTP client
  "react-native-reanimated": "~3.10.0",  // Animations
  "nativewind": "^4.0.0"          // Tailwind for RN
}
```

### Backend (Python)
```txt
fastapi==0.110.0            # Web framework
uvicorn[standard]==0.27.0   # ASGI server
sqlalchemy==2.0.27          # ORM
alembic==1.13.1             # Migrations
asyncpg==0.29.0             # PostgreSQL async driver
pydantic==2.6.1             # Data validation
pydantic-settings==2.1.0    # Settings management
python-jose[cryptography]   # JWT tokens
passlib[bcrypt]             # Password hashing
python-multipart            # File uploads
boto3==1.34.34              # AWS S3 storage
openai==1.12.0              # OpenAI API
anthropic==0.18.0           # Claude API (optional)
whisper                     # Audio transcription
pinecone-client             # Vector DB (or alternatives)
redis==5.0.1                # Caching
celery==5.3.6               # Background tasks
pytest==8.0.0               # Testing
pytest-asyncio==0.23.4      # Async testing
```

### Database & Storage
- **PostgreSQL** - Primary database (user data, metadata)
- **S3 (or MinIO locally)** - Audio files, images storage
- **Redis** - Caching, session management
- **Pinecone/Weaviate/ChromaDB** - Vector embeddings for semantic search

### AI/ML Services
- **OpenAI GPT-4** - Text summarization, insights, search
- **Whisper API** - Audio transcription
- **Text Embeddings** - Semantic search (OpenAI embeddings or sentence-transformers)

### Web (existing design)
```json
{
  "react": "18.3.1",
  "vite": "6.3.5",
  "typescript": "^5.0.0",
  "tailwindcss": "4.1.12",
  "motion": "12.23.24",
  "@radix-ui/*": "latest",
  "lucide-react": "0.487.0",
  "react-query": "^5.0.0",
  "axios": "^1.6.0"
}
```

---

## 📱 Mobile Architecture (React Native)

### Folder Structure Deep Dive

```typescript
// mobile/app/(tabs)/recall.tsx
export default function RecallScreen() {
  // Reuse logic from design/src/app/components/HomeRecall.tsx
  // But adapted for React Native components
}

// mobile/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

export const memoriesApi = {
  create: (data: CreateMemoryDto) => api.post('/memories', data),
  list: (params) => api.get('/memories', { params }),
  get: (id: string) => api.get(`/memories/${id}`),
  search: (query: string) => api.get('/memories/search', { params: { q: query } }),
};

export const aiApi = {
  summarize: (memoryId: string) => api.post(`/ai/summarize/${memoryId}`),
  getRecall: () => api.get('/ai/recall'),
  reflect: (thought: string) => api.post('/ai/reflect', { thought }),
};

export const storageApi = {
  uploadAudio: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/storage/audio', formData);
  },
};
```

---

## 🔧 Backend Architecture (FastAPI)

### Core Endpoints

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Memory AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# backend/app/api/memories.py
from fastapi import APIRouter, Depends, UploadFile
from typing import List

router = APIRouter(prefix="/memories", tags=["memories"])

@router.post("/", response_model=MemoryResponse)
async def create_memory(
    memory: CreateMemoryRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new memory (text, link, or voice)"""
    pass

@router.get("/", response_model=List[MemoryResponse])
async def list_memories(
    type: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """List all memories with optional filtering"""
    pass

@router.get("/search", response_model=SearchResponse)
async def search_memories(
    q: str,
    current_user: User = Depends(get_current_user)
):
    """AI-powered semantic search"""
    pass

@router.post("/audio/upload")
async def upload_audio(
    file: UploadFile,
    current_user: User = Depends(get_current_user)
):
    """Upload audio file, transcribe with Whisper"""
    # 1. Save to S3
    # 2. Transcribe with Whisper
    # 3. Generate embedding
    # 4. Return URL + transcription
    pass

# backend/app/api/ai.py
@router.get("/recall", response_model=RecallResponse)
async def get_recall(current_user: User = Depends(get_current_user)):
    """Get AI-powered memory recall suggestion"""
    # 1. Get user's recent context (last searches, new memories)
    # 2. Find relevant past memory using embeddings
    # 3. Generate contextual reason why it's relevant
    pass

@router.post("/reflect")
async def reflect_on_thought(
    request: ReflectRequest,
    current_user: User = Depends(get_current_user)
):
    """AI reflection on user's thought with relevant memories"""
    # 1. Generate embedding for thought
    # 2. Search vector DB for similar past memories
    # 3. Use GPT-4 to generate insight
    pass
```

### Database Models

```python
# backend/app/models/memory.py
from sqlalchemy import Column, String, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

class MemoryType(str, enum.Enum):
    TEXT = "text"
    LINK = "link"
    VOICE = "voice"

class Memory(Base):
    __tablename__ = "memories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(MemoryType), nullable=False)
    content = Column(Text, nullable=False)  # Text or link URL
    transcription = Column(Text, nullable=True)  # For voice
    audio_url = Column(String, nullable=True)  # S3 URL
    ai_summary = Column(Text, nullable=True)
    metadata = Column(JSONB, default={})  # Extra data
    embedding = Column(Vector(1536), nullable=True)  # pgvector
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    is_dismissed = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
```

---

## 🚀 Implementation Roadmap

### Phase 1: Backend Foundation (Week 1-2)
1. ✅ Set up FastAPI project structure
2. ✅ PostgreSQL + Alembic migrations
3. ✅ User authentication (JWT)
4. ✅ CRUD endpoints for memories
5. ✅ S3/MinIO storage setup
6. ✅ Audio upload + Whisper transcription
7. ✅ Basic tests

### Phase 2: AI Integration (Week 2-3)
1. ✅ OpenAI integration
2. ✅ Text embedding generation
3. ✅ Vector database setup (Pinecone/ChromaDB)
4. ✅ Semantic search endpoint
5. ✅ AI summarization
6. ✅ Recall algorithm

### Phase 3: Mobile App (Week 3-5)
1. ✅ Expo project setup
2. ✅ Navigation structure (Expo Router)
3. ✅ Port design components to React Native
4. ✅ API integration
5. ✅ Audio recording/playback
6. ✅ Clipboard detection
7. ✅ Local caching (AsyncStorage)

### Phase 4: Polish & Deploy (Week 5-6)
1. ✅ Testing (E2E, unit tests)
2. ✅ Performance optimization
3. ✅ Error handling
4. ✅ Analytics
5. ✅ Deploy backend (Railway/Render/AWS)
6. ✅ TestFlight build (iOS)
7. ✅ Documentation

---

## 🎯 Recommended Approach

### For You (Based on Your Skills)

Since you're familiar with:
- ✅ Python backend
- ✅ TypeScript/Vite/UI/UX
- ➡️ **I recommend React Native with Expo**

### Development Flow

```bash
# 1. Start backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 2. Start mobile (in another terminal)
cd mobile
npm install
npm start
# Press 'i' for iOS simulator

# 3. Start web (optional, in another terminal)
cd web
npm install
npm run dev
```

### Using Xcode Simulator

React Native will automatically use Xcode's iOS Simulator:

```bash
cd mobile
npm run ios  # Opens Xcode simulator automatically
```

---

## 💾 Storage Strategy

### Audio Files
- **Local Dev**: MinIO (S3-compatible, runs in Docker)
- **Production**: AWS S3 or Cloudflare R2
- **Max file size**: 25MB per audio
- **Format**: M4A or MP3

### Database
- **Local Dev**: PostgreSQL in Docker
- **Production**: Railway PostgreSQL / Supabase / AWS RDS

### Vector Embeddings
- **Option 1**: Pinecone (managed, easy)
- **Option 2**: pgvector (PostgreSQL extension)
- **Option 3**: ChromaDB (self-hosted)

---

## 🔐 Security Considerations

1. **Authentication**: JWT tokens with refresh tokens
2. **File Upload**: Signed URLs, virus scanning
3. **Rate Limiting**: Prevent abuse
4. **Encryption**: At rest (S3) and in transit (HTTPS)
5. **Data Privacy**: User data isolation, GDPR compliance

---

## 📊 Cost Estimation (Monthly)

### MVP Stage
- Backend hosting (Railway): $5-20
- PostgreSQL: $5-15
- S3 storage: ~$1-5 (depends on usage)
- OpenAI API: ~$10-50 (depends on usage)
- Pinecone: $0 (free tier) or $70
- **Total: $21-160/month**

### Production Scale
- Scale based on users
- Consider self-hosting Whisper to reduce costs
- Use cachingto minimize OpenAI calls

---

## 🎨 Design Adaptation Notes

Your current design is **excellent** and will translate well to React Native:

### Easy Adaptations:
- ✅ All layouts (Flexbox works the same)
- ✅ Most animations (react-native-reanimated)
- ✅ Color scheme (Tailwind → NativeWind)
- ✅ Component structure

### Need Native Components:
- `<div>` → `<View>`
- `<input>` → `<TextInput>`
- `<button>` → `<TouchableOpacity>` or `<Pressable>`
- Audio: `expo-av` instead of HTML5 audio
- File uploads: `expo-document-picker`

---

## 📝 Next Steps

1. **Decision**: Choose React Native or Native iOS
2. **Setup**: I can generate the complete monorepo structure
3. **Backend**: Start with FastAPI + PostgreSQL
4. **Mobile**: Port your design to React Native
5. **Integration**: Connect mobile to backend
6. **Test**: iOS simulator testing
7. **Deploy**: Backend + TestFlight

---

## ❓ Questions for You

1. **React Native vs Native iOS?** (I recommend React Native)
2. **AI Provider**: OpenAI or Anthropic Claude?
3. **Vector DB**: Pinecone (managed) or pgvector (free)?
4. **Audio Storage**: AWS S3 or Cloudflare R2?
5. **Deployment**: Railway, Render, or AWS?
6. **Timeline**: When do you want to launch?

---

Let me know your preferences and I'll generate the complete project structure! 🚀
