#!/bin/bash

# ==========================================================================
# Mobile Design Consistency Validation
# ==========================================================================
# Usage: bash test-design-changes.sh
#
# Validates current tabs/capture design implementation without brittle checks.
# ==========================================================================

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

check_file() {
  if [ -f "$1" ]; then
    pass "File exists: $1"
  else
    fail "File not found: $1"
  fi
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

print_header "Test 1: File Structure"
check_file "app/(tabs)/_layout.tsx"
check_file "app/capture.tsx"
check_file "app/(tabs)/insights.tsx"
check_file "components/ScreenHeader.tsx"
check_file "components/MemoryCard.tsx"
check_file "constants/ThemeContext.tsx"

print_header "Test 2: Tab Navigation Consistency"
check_grep "app/(tabs)/_layout.tsx" "tabBarInactiveTintColor: colors\.textMuted" "Tab inactive color uses theme token"
check_grep "app/(tabs)/_layout.tsx" "borderColor: colors\.tabBarBorder" "Tab bar border uses theme token"
check_grep "app/(tabs)/_layout.tsx" "Haptics\.(impactAsync|selectionAsync)" "Tab interactions include haptics"
check_grep "app/(tabs)/_layout.tsx" "name=\"home\"" "Home tab registered"
check_grep "app/(tabs)/_layout.tsx" "name=\"library\"" "Library tab registered"
check_grep "app/(tabs)/_layout.tsx" "name=\"insights\"" "Insights tab registered"
check_grep "app/(tabs)/_layout.tsx" "name=\"profile\"" "Profile tab registered"

print_header "Test 3: Capture Screen UX"
check_grep "app/capture.tsx" "function BottomModeBar" "Bottom mode selector exists"
check_grep "app/capture.tsx" "MODE_META\[key\]\.icon" "Mode selector uses icon system"
check_grep "app/capture.tsx" "<X size=\{20\}" "Header close icon uses Lucide"
check_grep "app/capture.tsx" "TEXT_WARN_THRESHOLD" "Text character threshold present"
check_grep "app/capture.tsx" "Haptics\.selectionAsync" "Capture mode change has haptics"
check_grep "app/capture.tsx" "colors\.brandAccent" "Capture primary action uses brand accent"

print_header "Test 4: Insights Screen UX"
check_grep "app/(tabs)/insights.tsx" "function SectionHeader\(\{ Icon" "Insights sections use icon header"
check_grep "app/(tabs)/insights.tsx" "<SectionHeader Icon=\{BarChart3\}" "Overview section icon applied"
check_grep "app/(tabs)/insights.tsx" "<SectionHeader Icon=\{CalendarDays\}" "Activity section icon applied"
check_grep "app/(tabs)/insights.tsx" "paddingHorizontal: 16" "Insights content uses unified 16px grid"
check_grep "app/(tabs)/insights.tsx" "colors\.brandAccent" "Insights CTA uses brand accent"

print_header "Test 5: Shared Components + Theme"
check_grep "components/ScreenHeader.tsx" "paddingHorizontal = 16" "ScreenHeader default padding unified"
check_grep "components/MemoryCard.tsx" "memory\.typeText" "MemoryCard type label is i18n-based"
check_grep "constants/ThemeContext.tsx" "accent: '#b85c20'" "Light theme accent is warm-neutral"
check_grep "constants/ThemeContext.tsx" "accent: '#d1804a'" "Dark theme accent is warm-neutral"

print_header "Test 6: TypeScript Check"
info "Running TypeScript compiler..."
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
  echo -e "${GREEN}All design consistency checks passed.${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}Some checks failed. Review output above.${NC}"
  exit 1
fi
