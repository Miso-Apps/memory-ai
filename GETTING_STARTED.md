# Getting Started - DukiAI Memory Implementation Guide

## 🎯 Decision Matrix

Help you choose the right stack based on your priorities:

| Priority | React Native | Native iOS (Swift) |
|----------|--------------|-------------------|
| **Development Speed** | ⭐⭐⭐⭐⭐ (Reuse 80% code) | ⭐⭐ (Start from scratch) |
| **Your Skillset Match** | ⭐⭐⭐⭐⭐ (TS/React) | ⭐ (New language) |
| **Cross-platform** | ⭐⭐⭐⭐⭐ (iOS+Android) | ❌ (iOS only) |
| **Native Performance** | ⭐⭐⭐⭐ (Very Good) | ⭐⭐⭐⭐⭐ (Perfect) |
| **Native APIs Access** | ⭐⭐⭐⭐ (95% coverage) | ⭐⭐⭐⭐⭐ (100%) |
| **Component Reuse** | ⭐⭐⭐⭐⭐ (from design/) | ❌ (Rewrite all) |
| **Time to Market** | ⭐⭐⭐⭐⭐ (2-3 weeks) | ⭐⭐ (6-8 weeks) |
| **Xcode Usage** | ✅ (iOS Simulator) | ✅ (Full Xcode) |
| **Recommended?** | ✅ **YES** | Only if you want to learn Swift |

---

## 🚀 Quick Start Guide

### Prerequisites

```bash
# Install Node.js, Python, and Xcode (for iOS simulator)
brew install node python@3.11
# Install Xcode from App Store

# Verify installations
node --version    # v18+ required
python3 --version # 3.11+ required
xcodebuild -version  # Xcode 15+
```

---

## 📦 Option A: React Native Setup (Recommended)

### Step 1: Create Monorepo Structure

```bash
cd /Users/brian/Projects/Startups/memory-ai

# Create directories
mkdir -p mobile backend web shared/types docs scripts

# Move existing design into web
mv design/* web/ 2>/dev/null || true
rmdir design 2>/dev/null || true
```

### Step 2: Initialize Mobile App (Expo)

```bash
# Create Expo app
npx create-expo-app mobile --template blank-typescript

cd mobile

# Install dependencies
npm install expo-router expo-av expo-file-system expo-clipboard \
            expo-haptics @react-native-async-storage/async-storage \
            zustand @tanstack/react-query axios \
            react-native-reanimated nativewind \
            @shopify/flash-list lucide-react-native

# Setup NativeWind (Tailwind for React Native)
npm install --save-dev tailwindcss
npx tailwindcss init

# Configure Expo Router
npx expo install expo-router react-native-safe-area-context \
                 react-native-screens expo-linking expo-constants \
                 expo-status-bar

cd ..
```

### Step 3: Initialize Backend (FastAPI)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Create requirements.txt
cat > requirements.txt << EOF
fastapi==0.110.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.27
alembic==1.13.1
asyncpg==0.29.0
pydantic==2.6.1
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
boto3==1.34.34
openai==1.12.0
redis==5.0.1
pytest==8.0.0
pytest-asyncio==0.23.4
httpx==0.27.0
EOF

# Install dependencies
pip install -r requirements.txt

cd ..
```

### Step 4: Setup Docker for Local Development

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL with pgvector
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: memoryai
      POSTGRES_PASSWORD: dev_password_change_me
      POSTGRES_DB: memoryai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - memory-network

  # Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - memory-network

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    networks:
      - memory-network

volumes:
  postgres_data:
  minio_data:

networks:
  memory-network:
    driver: bridge
EOF

# Start services
docker-compose up -d
```

### Step 5: Create Backend Structure

```bash
cd backend

# Create directory structure
mkdir -p app/{api,models,schemas,services,utils} alembic tests

# Create main.py
cat > app/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="DukiAI Memory API",
    description="Backend for DukiAI Memory - Your personal memory companion",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "DukiAI Memory API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
EOF

# Create config.py
cat > app/config.py << 'EOF'
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://memoryai:dev_password_change_me@localhost:5432/memoryai"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    # S3/MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "memory-ai"
    
    class Config:
        env_file = ".env"

settings = Settings()
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql+asyncpg://memoryai:dev_password_change_me@localhost:5432/memoryai

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# S3/MinIO (local)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=memory-ai
EOF

cd ..
```

### Step 6: Initialize Alembic (Database Migrations)

```bash
cd backend

# Initialize Alembic
alembic init alembic

# Create first migration
cat > alembic/versions/001_init.py << 'EOF'
"""Initial schema

Revision ID: 001
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now())
    )
    
    # Memories table
    op.create_table(
        'memories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('transcription', sa.Text),
        sa.Column('audio_url', sa.String(512)),
        sa.Column('audio_duration', sa.Integer),
        sa.Column('ai_summary', sa.Text),
        sa.Column('embedding', sa.String),  # pgvector type
        sa.Column('metadata', postgresql.JSONB, server_default='{}'),
        sa.Column('is_dismissed', sa.Boolean, server_default='false'),
        sa.Column('is_deleted', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now())
    )
    
    # Create indexes
    op.create_index('idx_memories_user_id', 'memories', ['user_id'])
    op.create_index('idx_memories_type', 'memories', ['type'])
    op.create_index('idx_memories_created_at', 'memories', ['created_at'])

def downgrade():
    op.drop_table('memories')
    op.drop_table('users')
    op.execute('DROP EXTENSION IF EXISTS vector')
EOF

# Run migration
alembic upgrade head

cd ..
```

### Step 7: Create Development Scripts

```bash
# Create scripts directory
mkdir -p scripts

# Dev script to start all services
cat > scripts/dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting DukiAI Memory Development Environment"
echo ""

# Start Docker services
echo "📦 Starting Docker services (PostgreSQL, Redis, MinIO)..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 5

# Start backend
echo "🔧 Starting Backend (FastAPI)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start mobile
echo "📱 Starting Mobile App (Expo)..."
cd mobile
npm start &
MOBILE_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "📱 Mobile: Open Expo Go and scan QR code"
echo "🔧 Backend: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "🗄️  MinIO: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $MOBILE_PID; docker-compose down; exit" INT
wait
EOF

chmod +x scripts/dev.sh

# Setup script
cat > scripts/setup.sh << 'EOF'
#!/bin/bash

echo "🛠️  Setting up DukiAI Memory Development Environment"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install with: brew install node"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 not found. Install with: brew install python@3.11"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not found. Install Docker Desktop"; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Backend setup
echo "🔧 Setting up Backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
echo "⚠️  Please edit backend/.env and add your OPENAI_API_KEY"
cd ..

# Mobile setup
echo "📱 Setting up Mobile..."
cd mobile
npm install
cd ..

# Web setup
echo "🌐 Setting up Web..."
cd web
npm install
cd ..

# Start Docker services
echo "📦 Starting Docker services..."
docker-compose up -d

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your OPENAI_API_KEY to backend/.env"
echo "2. Run: ./scripts/dev.sh"
echo ""
EOF

chmod +x scripts/setup.sh
```

### Step 8: Run Initial Setup

```bash
# Run setup script
./scripts/setup.sh

# Edit backend/.env and add your OpenAI API key
# nano backend/.env  # or use your preferred editor

# Start development
./scripts/dev.sh
```

### Step 9: Create Mobile App Structure

```bash
cd mobile

# Create the file-based routing structure
mkdir -p app/{(tabs),memory,_layout}

# Create root layout
cat > app/_layout.tsx << 'EOF'
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="memory/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
EOF

# Create tabs layout
cat > app/(tabs)/_layout.tsx << 'EOF'
import { Tabs } from 'expo-router';
import { Bell, Archive, User } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="recall"
        options={{
          title: 'Nhắc',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Kho',
          tabBarIcon: ({ color, size }) => <Archive color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
EOF

# Create recall screen (example)
cat > app/(tabs)/recall.tsx << 'EOF'
import { View, Text, StyleSheet } from 'react-native';

export default function RecallScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nhắc</Text>
      <Text style={styles.subtitle}>Những gì bạn lưu có thể hữu ích trở lại</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
EOF

# Create archive screen
cat > app/(tabs)/archive.tsx << 'EOF'
import { View, Text, StyleSheet } from 'react-native';

export default function ArchiveScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kho</Text>
      <Text style={styles.subtitle}>Tìm kiếm và duyệt memories</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
EOF

# Create profile screen
cat > app/(tabs)/profile.tsx << 'EOF'
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu</Text>
      <Text style={styles.subtitle}>Profile & Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
EOF

cd ..
```

---

## 📦 Option B: Native iOS Setup (Alternative)

Only choose this if you want to learn Swift/SwiftUI and don't mind starting from scratch.

### Step 1: Create Xcode Project

```bash
# Open Xcode
open -a Xcode

# Create New Project
# - Choose "App" template
# - Product Name: MemoryAI
# - Interface: SwiftUI
# - Language: Swift
# - Location: /Users/brian/Projects/Startups/memory-ai/ios
```

### Step 2: Project Structure

```
ios/
├── MemoryAI/
│   ├── Models/
│   │   ├── Memory.swift
│   │   └── User.swift
│   ├── Views/
│   │   ├── HomeRecallView.swift
│   │   ├── ArchiveView.swift
│   │   ├── QuickCaptureView.swift
│   │   └── ProfileView.swift
│   ├── ViewModels/
│   │   ├── MemoryViewModel.swift
│   │   └── AuthViewModel.swift
│   ├── Services/
│   │   ├── APIService.swift
│   │   ├── AudioService.swift
│   │   └── StorageService.swift
│   └── MemoryAIApp.swift
```

### Step 3: Install Dependencies (Swift Package Manager)

Add in Xcode:
- Alamofire (networking)
- SwiftUI Introspection
- Kingfisher (image loading)

---

## 🧪 Testing Your Setup

### Test Backend

```bash
# In one terminal
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# In another terminal
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### Test Mobile App

```bash
cd mobile
npm start

# Press 'i' for iOS simulator
# Or scan QR code with Expo Go app on your phone
```

### Test Database Connection

```bash
# Connect to PostgreSQL
docker exec -it memory-ai-postgres-1 psql -U memoryai -d memoryai

# List tables
\dt

# Exit
\q
```

---

## 📚 Next Implementation Steps

### Week 1: Backend Core
1. ✅ Implement user registration/login endpoints
2. ✅ Create memory CRUD endpoints
3. ✅ Set up file upload to S3/MinIO
4. ✅ Add basic authentication middleware
5. ✅ Write tests for API endpoints

### Week 2: AI Integration
1. ✅ Integrate OpenAI API
2. ✅ Implement embedding generation
3. ✅ Set up vector search (pgvector or Pinecone)
4. ✅ Create summarization endpoint
5. ✅ Build recall algorithm

### Week 3: Mobile Development
1. ✅ Port HomeRecall component
2. ✅ Implement QuickCapture
3. ✅ Build Archive/Search screen
4. ✅ Add audio recording
5. ✅ Implement API integration

### Week 4: Polish & Testing
1. ✅ Add loading states and error handling
2. ✅ Implement offline support
3. ✅ Add animations
4. ✅ E2E testing
5. ✅ Performance optimization

---

## 🎓 Learning Resources

### React Native
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Tutorial](https://reactnative.dev/docs/tutorial)
- [Expo Router Guide](https://docs.expo.dev/router/introduction/)

### FastAPI
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Full Stack FastAPI](https://github.com/tiangolo/full-stack-fastapi-template)

### AI/ML
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Vector Databases Guide](https://www.pinecone.io/learn/vector-database/)
- [pgvector Tutorial](https://github.com/pgvector/pgvector)

### SwiftUI (if going native)
- [100 Days of SwiftUI](https://www.hackingwithswift.com/100/swiftui)
- [Apple SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)

---

## 💡 Pro Tips

1. **Start with Backend First** - It's the foundation
2. **Use Postman/Thunder Client** - Test APIs as you build
3. **Version Control** - Commit frequently
4. **Code Reuse** - Your design folder has 80% of the UI logic
5. **Test Early** - Don't wait until the end
6. **Use TypeScript Strictly** - Better DX and fewer bugs
7. **Monitor OpenAI Costs** - Can add up quickly
8. **Cache Aggressively** - Reduce API calls

---

## 🆘 Common Issues & Solutions

### Issue: Expo won't start
```bash
# Clear cache
cd mobile
npx expo start -c
```

### Issue: PostgreSQL connection error
```bash
# Check if Docker is running
docker ps

# Restart services
docker-compose restart postgres
```

### Issue: "Module not found"
```bash
# Clear metro bundler cache
cd mobile
npm start -- --reset-cache
```

### Issue: OpenAI API errors
```bash
# Check your API key in backend/.env
# Verify you have credits: https://platform.openai.com/usage
```

---

Ready to start? Run:

```bash
./scripts/setup.sh
```

Questions? Check [TECHNICAL_PROPOSAL.md](./TECHNICAL_PROPOSAL.md) for architecture details!
