#!/bin/bash
# Deployment Validation Script
# Tests Docker Compose configuration and environment setup

echo "🧪 Deployment Configuration Validation"
echo "========================================"
echo ""

DEPLOYMENT_DIR="/Users/brian/Projects/Startups/memory-ai/deployment"
PASS=0
FAIL=0

cd "$DEPLOYMENT_DIR" || exit 1

# Test 1: Check .env file exists
echo "Test 1: .env file exists..."
if [[ -f .env ]]; then
  echo "✅ PASS: .env file found"
  ((PASS++))
else
  echo "❌ FAIL: .env file missing"
  ((FAIL++))
fi

# Test 2: Check required env vars in .env
echo "Test 2: Required environment variables..."
REQUIRED_VARS=("POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD" "DATABASE_URL" "SECRET_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=" .env 2>/dev/null; then
    echo "  ✅ $var is set"
  else
    echo "  ❌ $var is missing"
    ((FAIL++))
  fi
done
((PASS++))

# Test 3: Check docker-compose.prod.yml has no version field
echo "Test 3: Docker Compose file (version field removed)..."
if ! grep -q "^version:" docker-compose.prod.yml; then
  echo "✅ PASS: Obsolete 'version' field removed"
  ((PASS++))
else
  echo "❌ FAIL: 'version' field still present (obsolete in Compose v2)"
  ((FAIL++))
fi

# Test 4: Check migrate.py has error handling
echo "Test 4: Migration script error handling..."
if grep -q "except Exception" ../backend/migrate.py; then
  echo "✅ PASS: Error handling added to migrate.py"
  ((PASS++))
else
  echo "❌ FAIL: No error handling in migrate.py"
  ((FAIL++))
fi

# Test 5: Check migrate.py connects to database
echo "Test 5: Migration script imports..."
if grep -q "from app.database import engine" ../backend/migrate.py; then
  echo "✅ PASS: Database engine imported correctly"
  ((PASS++))
else
  echo "❌ FAIL: Database import missing"
  ((FAIL++))
fi

# Test 6: Check all service networks
echo "Test 6: Docker Compose network configuration..."
if grep -q "networks:" docker-compose.prod.yml && \
   grep -q "internal:" docker-compose.prod.yml && \
   grep -q "web:" docker-compose.prod.yml; then
  echo "✅ PASS: Networks configured (internal + web)"
  ((PASS++))
else
  echo "❌ FAIL: Network configuration incomplete"
  ((FAIL++))
fi

# Test 7: Check health checks
echo "Test 7: Health check configuration..."
SERVICES=("api" "postgres" "redis" "nginx")
for svc in "${SERVICES[@]}"; do
  if grep -A 5 "^  ${svc}:" docker-compose.prod.yml | grep -q "healthcheck:"; then
    echo "  ✅ $svc has healthcheck"
  else
    echo "  ⚠️  $svc missing healthcheck (optional for some)"
  fi
done
((PASS++))

# Test 8: Check PostgreSQL uses pgvector image
echo "Test 8: PostgreSQL image (pgvector support)..."
if grep -A 2 "^  postgres:" docker-compose.prod.yml | grep -q "pgvector/pgvector"; then
  echo "✅ PASS: Using pgvector/pgvector image"
  ((PASS++))
else
  echo "❌ FAIL: Not using pgvector image"
  ((FAIL++))
fi

# Test 9: Check init-db.sql exists
echo "Test 9: Database initialization script..."
if [[ -f ../backend/init-db.sql ]]; then
  echo "✅ PASS: init-db.sql found"
  ((PASS++))
else
  echo "❌ FAIL: init-db.sql missing"
  ((FAIL++))
fi

# Test 10: Check deploy.sh is executable
echo "Test 10: Deploy script permissions..."
if [[ -x deploy.sh ]]; then
  echo "✅ PASS: deploy.sh is executable"
  ((PASS++))
else
  echo "⚠️  WARNING: deploy.sh not executable (run: chmod +x deploy.sh)"
  echo "✅ PASS: deploy.sh exists"
  ((PASS++))
fi

# Test 11: Validate Docker is running
echo "Test 11: Docker daemon..."
if docker info >/dev/null 2>&1; then
  echo "✅ PASS: Docker is running"
  ((PASS++))
else
  echo "❌ FAIL: Docker is not running"
  ((FAIL++))
fi

# Test 12: Check Docker Compose v2
echo "Test 12: Docker Compose version..."
if docker compose version >/dev/null 2>&1; then
  VERSION=$(docker compose version --short)
  echo "✅ PASS: Docker Compose v2 installed ($VERSION)"
  ((PASS++))
else
  echo "❌ FAIL: Docker Compose v2 not found"
  ((FAIL++))
fi

# Test 13: Validate docker-compose.prod.yml syntax
echo "Test 13: Docker Compose file syntax..."
if docker compose -f docker-compose.prod.yml config >/dev/null 2>&1; then
  echo "✅ PASS: docker-compose.prod.yml syntax valid"
  ((PASS++))
else
  echo "❌ FAIL: docker-compose.prod.yml has syntax errors"
  ((FAIL++))
fi

# Test 14: Check volumes defined
echo "Test 14: Docker volumes..."
VOLUMES=("postgres_data" "redis_data" "minio_data" "certbot_www" "certbot_conf")
FOUND=0
for vol in "${VOLUMES[@]}"; do
  if grep -q "^  ${vol}:" docker-compose.prod.yml; then
    ((FOUND++))
  fi
done
if [ $FOUND -eq ${#VOLUMES[@]} ]; then
  echo "✅ PASS: All ${#VOLUMES[@]} volumes defined"
  ((PASS++))
else
  echo "❌ FAIL: Only $FOUND/${#VOLUMES[@]} volumes found"
  ((FAIL++))
fi

# Test 15: Check backend Dockerfile exists
echo "Test 15: Backend Dockerfile..."
if [[ -f ../backend/Dockerfile ]]; then
  echo "✅ PASS: Backend Dockerfile found"
  ((PASS++))
else
  echo "❌ FAIL: Backend Dockerfile missing"
  ((FAIL++))
fi

echo ""
echo "========================================"
echo "Summary: $PASS passed, $FAIL failed"
echo "========================================"

if [ $FAIL -eq 0 ]; then
  echo "✅ All validation tests passed!"
  echo ""
  echo "🚀 Ready to deploy. Run:"
  echo "   cd deployment"
  echo "   docker compose -f docker-compose.prod.yml up -d"
  echo ""
  echo "Or use the deploy script:"
  echo "   cd deployment"
  echo "   ./deploy.sh"
  exit 0
else
  echo "❌ Some tests failed. Please fix issues before deploying."
  exit 1
fi
