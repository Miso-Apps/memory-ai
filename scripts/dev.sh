#!/bin/bash

# DukiAI Memory - Development Script
# Starts all development services
# Usage: ./scripts/dev.sh [--ios|--android|--web|--backend-only]

set -e

# Parse arguments
PLATFORM=""
BACKEND_ONLY=false

case "$1" in
    --ios)
        PLATFORM="ios"
        ;;
    --android)
        PLATFORM="android"
        ;;
    --web)
        PLATFORM="web"
        ;;
    --backend-only)
        BACKEND_ONLY=true
        ;;
esac

# Cleanup function
cleanup_ports() {
    echo "🧹 Cleaning up ports..."
    # Kill any process on port 8081 (Metro bundler)
    lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true
    # Kill any process on port 8000 (FastAPI)
    lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
    # Kill any process on port 5173 (Vite web app)
    lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
    # Kill any hanging Expo/Metro processes
    pkill -f "expo start" 2>/dev/null || true
    pkill -f "node.*metro" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    sleep 1
}

echo "🚀 Starting DukiAI Memory Development Environment"
echo "=============================================="
echo ""

# Clean up ports before starting
cleanup_ports

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Start Docker services
echo "📦 Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check services
echo ""
if docker ps | grep -q "memory-ai-postgres"; then
    echo -e "${GREEN}✅ PostgreSQL: Running on port 5432${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL: Not running${NC}"
fi

if docker ps | grep -q "memory-ai-redis"; then
    echo -e "${GREEN}✅ Redis: Running on port 6379${NC}"
else
    echo -e "${YELLOW}⚠️  Redis: Not running${NC}"
fi

if docker ps | grep -q "memory-ai-minio"; then
    echo -e "${GREEN}✅ MinIO: Running on port 9000 (Console: 9001)${NC}"
else
    echo -e "${YELLOW}⚠️  MinIO: Not running${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔧 Starting Backend (FastAPI)..."
echo ""

# Start backend in new terminal/background
cd backend
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: backend/.env not found. Using .env.example${NC}"
    cp .env.example .env
fi

# Start backend
echo "Starting backend on http://localhost:8000..."
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start Mobile App (unless backend-only mode)
if [ "$BACKEND_ONLY" = false ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    if [ "$PLATFORM" = "web" ]; then
        echo "🌐 Starting Web App (Vite)..."
        echo ""
        (cd web && npm run dev -- --host 0.0.0.0) &
        WEB_PID=$!
        MOBILE_PID=""
    else
        echo "📱 Starting Mobile App (Expo)..."
        echo ""

        # Increase file descriptor limit for Metro bundler
        ulimit -n 10240

        # Clear Expo cache if it exists
        if [ -d "mobile/.expo" ]; then
            rm -rf mobile/.expo mobile/node_modules/.cache
            echo "Cleared Expo cache"
        fi

        # Start expo with platform flag if specified in a subshell
        if [ -n "$PLATFORM" ]; then
            echo "Opening $PLATFORM simulator..."
            (cd mobile && npx expo start --clear --$PLATFORM) &
        else
            (cd mobile && npx expo start --clear) &
        fi
        MOBILE_PID=$!
        WEB_PID=""
    fi
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}📱 Skipping mobile app (backend-only mode)${NC}"
    MOBILE_PID=""
    WEB_PID=""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service URLs:"
echo ""
if [ "$BACKEND_ONLY" = false ]; then
    if [ "$PLATFORM" = "web" ]; then
        echo "  🌐 Web App:  ${BLUE}http://localhost:5173${NC}"
    else
        echo "  📱 Mobile:   Open Expo Go and scan QR code"
    fi
fi
echo "  🔧 Backend:  ${BLUE}http://localhost:8000${NC}"
echo "  📚 API Docs: ${BLUE}http://localhost:8000/docs${NC}"
echo "  🗄️  MinIO:   ${BLUE}http://localhost:9001${NC} (minioadmin/minioadmin)"
if [ "$BACKEND_ONLY" = false ]; then
    if [ "$PLATFORM" = "web" ]; then
        echo "  • Web app runs with Vite on port 5173"
    elif [ -z "$PLATFORM" ]; then
        echo ""
        echo "📱 Mobile Controls:"
        echo "  • Press 'i' in Expo terminal to open iOS simulator"
        echo "  • Press 'a' for Android emulator"
        echo "  • Press 'w' for web browser"
        echo "  • Or restart with: ./scripts/dev.sh --ios"
    else
        echo "  • $PLATFORM simulator should open automatically"
    fi
fi
echo ""
echo "💡 Tips:"
echo "  • Backend auto-reloads on file changes"
if [ "$BACKEND_ONLY" = false ] && [ "$PLATFORM" != "web" ]; then
    echo "  • Metro bundler runs on port 8081"
    echo "  • Shake device/Cmd+D to open developer menu"
fi
if [ "$PLATFORM" = "web" ]; then
    echo "  • Web app hot-reloads on http://localhost:5173"
fi
echo "  • View logs in this terminal"
echo ""
echo "🔧 Troubleshooting:"
if [ "$PLATFORM" = "web" ]; then
    echo "  • Port conflict: lsof -ti:5173 | xargs kill -9"
    echo "  • Restart web: cd web && npm run dev"
else
    echo "  • Port conflict: lsof -ti:8081 | xargs kill -9"
    echo "  • Clear cache: cd mobile && rm -rf .expo node_modules/.cache"
    echo "  • Restart Metro: Press 'r' in Expo terminal"
fi
echo ""
echo "🛑 To stop all services: Press Ctrl+C"
echo ""

# Trap Ctrl+C and cleanup
final_cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    
    # Kill backend
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill mobile
    if [ -n "$MOBILE_PID" ]; then
        kill $MOBILE_PID 2>/dev/null || true
    fi

    # Kill web
    if [ -n "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi
    
    # Clean up ports
    cleanup_ports
    
    # Stop Docker
    echo "Stopping Docker services..."
    docker-compose down
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap final_cleanup INT TERM

# Keep script running
wait
