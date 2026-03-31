#!/bin/bash

# ==========================================================================
# Tab Bar Enhancement Validation (Current Implementation)
# ==========================================================================
# Usage: bash test-tab-bar-enhancement.sh
# ==========================================================================

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED+=1))
  ((TOTAL_TESTS+=1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED+=1))
  ((TOTAL_TESTS+=1))
}

check_grep() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

FILE="app/(tabs)/_layout.tsx"

print_header "Test 1: File and Imports"
if [ -f "$FILE" ]; then
  pass "Tab layout file exists"
else
  fail "Tab layout file missing"
fi
check_grep "$FILE" "Animated" "Animated API imported/used"
check_grep "$FILE" "Haptics" "Haptics imported/used"
check_grep "$FILE" "Platform" "Platform imported/used"

print_header "Test 2: Icon Animation"
check_grep "$FILE" "scaleAnim.*Animated\.Value" "Scale animated value initialized"
check_grep "$FILE" "opacityAnim.*Animated\.Value" "Opacity animated value initialized"
check_grep "$FILE" "Animated\.parallel" "Parallel animation used"
check_grep "$FILE" "Animated\.spring" "Spring animation used"
check_grep "$FILE" "Animated\.timing" "Timing animation used"
check_grep "$FILE" "useNativeDriver: true" "Native driver enabled"

print_header "Test 3: Haptic Interaction"
check_grep "$FILE" "function EnhancedTabButton" "EnhancedTabButton exists"
check_grep "$FILE" "Haptics\.impactAsync" "Impact haptic call exists"
check_grep "$FILE" "Haptics\.selectionAsync" "Selection haptic call exists"

print_header "Test 4: Tab Registration"
check_grep "$FILE" "name=\"home\"" "Home tab exists"
check_grep "$FILE" "name=\"library\"" "Library tab exists"
check_grep "$FILE" "name=\"insights\"" "Insights tab exists"
check_grep "$FILE" "name=\"profile\"" "Profile tab exists"
check_grep "$FILE" "name=\"create\"" "Create tab exists"

print_header "Test 5: Visual Tokens"
check_grep "$FILE" "tabBarInactiveTintColor: colors\.textMuted" "Inactive tab color uses theme token"
check_grep "$FILE" "backgroundColor: colors\.tabBarBg" "Tab bar background uses theme token"
check_grep "$FILE" "borderColor: colors\.tabBarBorder" "Tab bar border uses theme token"
check_grep "$FILE" "backgroundColor: colors\.brandAccent" "Create button uses brand accent"
check_grep "$FILE" "iconBackground" "Icon active background layer exists"

print_header "Test 6: TypeScript Check"
if npx tsc --noEmit --skipLibCheck >/dev/null 2>&1; then
  pass "TypeScript compilation successful"
else
  fail "TypeScript compilation failed"
fi

print_header "Summary"
echo -e "Total Tests: ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo ""
  echo -e "${GREEN}Tab bar enhancement checks passed.${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}Some tab bar checks failed. Review output above.${NC}"
  exit 1
fi
