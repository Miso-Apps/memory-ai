#!/bin/bash

# DukiAI Memory - Setup Script
# This script sets up the development environment

set -e  # Exit on error

echo "🛠️  DukiAI Memory - Development Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Install with: brew install node"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 not found${NC}"
    echo "Install with: brew install python@3.11"
    exit 1
fi
echo -e "${GREEN}✅ Python $(python3 --version)${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker $(docker --version)${NC}"

# Check Watchman (recommended for React Native)
if ! command -v watchman &> /dev/null; then
    echo -e "${YELLOW}⚠️  Watchman not found (recommended for React Native)${NC}"
    echo "   Install with: brew install watchman"
else
    echo -e "${GREEN}✅ Watchman $(watchman --version | head -1)${NC}"
fi

# Check Expo CLI
if ! command -v expo &> /dev/null; then
    echo -e "${YELLOW}⚠️  Expo CLI not found (will be installed locally)${NC}"
else
    echo -e "${GREEN}✅ Expo CLI installed${NC}"
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Backend setup
echo "🔧 Setting up Backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Created Python virtual environment${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo -e "${GREEN}✅ Installed Python dependencies${NC}"

# Copy .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Created .env file - Please add your OPENAI_API_KEY${NC}"
fi

cd ..

# Mobile setup
echo ""
echo "📱 Setting up Mobile..."
cd mobile

if [ ! -d "node_modules" ]; then
    echo "Installing with --legacy-peer-deps to handle Expo SDK 51 dependencies..."
    npm install --legacy-peer-deps
    echo -e "${GREEN}✅ Installed mobile dependencies${NC}"
else
    echo -e "${GREEN}✅ Mobile dependencies already installed${NC}"
    echo -e "${YELLOW}💡 If you have issues, run: cd mobile && rm -rf node_modules package-lock.json && npm install --legacy-peer-deps${NC}"
fi

# Clear Expo cache
if [ -d ".expo" ]; then
    rm -rf .expo
    echo -e "${GREEN}✅ Cleared Expo cache${NC}"
fi

cd ..

# Web setup
echo ""
echo "🌐 Setting up Web..."
cd web

if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Installed web dependencies${NC}"
else
    echo -e "${GREEN}✅ Web dependencies already installed${NC}"
fi

cd ..

# Start Docker services
echo ""
echo "🐳 Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are healthy
if docker ps | grep -q "memory-ai-postgres"; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
fi

if docker ps | grep -q "memory-ai-redis"; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis failed to start${NC}"
fi

if docker ps | grep -q "memory-ai-minio"; then
    echo -e "${GREEN}✅ MinIO is running${NC}"
else
    echo -e "${RED}❌ MinIO failed to start${NC}"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Add your OpenAI API key to backend/.env:"
echo "   ${YELLOW}nano backend/.env${NC}"
echo ""
echo "2. Install Expo Go on your device (optional):"
echo "   iOS: https://apps.apple.com/app/expo-go/id982107779"
echo "   Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
echo ""
echo "3. Start the development environment:"
echo "   ${GREEN}./scripts/dev.sh --ios${NC}     # iOS simulator"
echo "   ${GREEN}./scripts/dev.sh --android${NC} # Android emulator"
echo "   ${GREEN}./scripts/dev.sh${NC}           # Start without opening simulator"
echo ""
echo "💡 Common issues:"
echo "   • Metro bundler issues: cd mobile && rm -rf .expo node_modules/.cache"
echo "   • Port conflicts: lsof -ti:8081 | xargs kill -9"
echo "   • Package issues: cd mobile && npm install --legacy-peer-deps"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
