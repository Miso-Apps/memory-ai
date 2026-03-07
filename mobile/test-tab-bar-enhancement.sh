#!/bin/bash

# ============================================================================
# Tab Bar Enhancement - Validation Script
# ============================================================================
# This script validates the LinkedIn-inspired tab bar enhancements
#
# Usage: bash test-tab-bar-enhancement.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
    ((TOTAL_TESTS++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

check_string_in_file() {
    local file=$1
    local search_string=$2
    local description=$3
    
    if grep -q "$search_string" "$file"; then
        print_success "$description"
        return 0
    else
        print_error "$description"
        return 1
    fi
}

# ============================================================================
# Test 1: File Existence
# ============================================================================

print_header "Test 1: Verify File Structure"

if [ -f "app/(tabs)/_layout.tsx" ]; then
    print_success "Tab layout file exists"
else
    print_error "Tab layout file not found"
fi

if [ -f "TAB_BAR_ENHANCEMENT.md" ]; then
    print_success "Documentation exists"
else
    print_error "Documentation not found"
fi

if [ -f "TAB_BAR_VISUAL_COMPARISON.md" ]; then
    print_success "Visual comparison doc exists"
else
    print_error "Visual comparison doc not found"
fi

# ============================================================================
# Test 2: Required Imports
# ============================================================================

print_header "Test 2: Verify Required Imports"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "import.*Animated.*from 'react-native'" \
    "Animated imported"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "import.*Platform.*from 'react-native'" \
    "Platform imported"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "import.*Haptics.*from 'expo-haptics'" \
    "Haptics imported"

# ============================================================================
# Test 3: TabIcon Component Enhancements
# ============================================================================

print_header "Test 3: Verify TabIcon Component"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "const scaleAnim.*=.*useRef.*new Animated.Value" \
    "Scale animation initialized"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "const opacityAnim.*=.*useRef.*new Animated.Value" \
    "Opacity animation initialized"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Animated.parallel" \
    "Parallel animations used"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Animated.spring" \
    "Spring animation for scale"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Animated.timing" \
    "Timing animation for opacity"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "iconBackground" \
    "Background layer component"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "useNativeDriver: true" \
    "Native driver enabled"

# ============================================================================
# Test 4: EnhancedTabButton Component
# ============================================================================

print_header "Test 4: Verify EnhancedTabButton Component"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "function EnhancedTabButton" \
    "EnhancedTabButton component exists"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Haptics.impactAsync.*ImpactFeedbackStyle.Light" \
    "iOS haptic feedback (light impact)"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Haptics.selectionAsync" \
    "Android haptic feedback (selection)"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Platform.OS.*===.*'ios'" \
    "Platform-specific haptic logic"

# ============================================================================
# Test 5: Tab Button Applications
# ============================================================================

print_header "Test 5: Verify Tab Button Applications"

# Count occurrences of EnhancedTabButton
enhanced_count=$(grep -c "tabBarButton.*EnhancedTabButton" "app/(tabs)/_layout.tsx" || echo "0")

if [ "$enhanced_count" -eq 4 ]; then
    print_success "EnhancedTabButton applied to all 4 tabs"
else
    print_error "EnhancedTabButton should be applied to 4 tabs, found: $enhanced_count"
fi

check_string_in_file "app/(tabs)/_layout.tsx" \
    'name="home"' \
    "Home tab exists"

check_string_in_file "app/(tabs)/_layout.tsx" \
    'name="library"' \
    "Library tab exists"

check_string_in_file "app/(tabs)/_layout.tsx" \
    'name="chat"' \
    "Chat tab exists"

check_string_in_file "app/(tabs)/_layout.tsx" \
    'name="profile"' \
    "Profile tab exists"

# ============================================================================
# Test 6: Tab Bar Styling
# ============================================================================

print_header "Test 6: Verify Tab Bar Styling"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "height:.*88.*76" \
    "Tab bar height increased"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "paddingTop: 8" \
    "Tab bar top padding updated"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "paddingBottom:.*12.*10" \
    "Tab bar bottom padding updated"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "shadowColor.*shadowOffset.*shadowOpacity.*shadowRadius" \
    "iOS shadow properties exist"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "elevation: 8" \
    "Android elevation added"

# ============================================================================
# Test 7: Label Styling
# ============================================================================

print_header "Test 7: Verify Label Styling"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "fontWeight: '600'" \
    "Label font weight increased to 600"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "marginTop: 4" \
    "Label margin top increased"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "letterSpacing: 0.1" \
    "Label letter spacing added"

# ============================================================================
# Test 8: Icon Styling
# ============================================================================

print_header "Test 8: Verify Icon Styling"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "width: 40" \
    "Icon container width is 40px"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "height: 40" \
    "Icon container height is 40px"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "borderRadius: 20" \
    "Icon background border radius is 20px"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "position: 'absolute'" \
    "Background layer positioned absolutely"

# ============================================================================
# Test 9: Animation Parameters
# ============================================================================

print_header "Test 9: Verify Animation Parameters"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "tension: 300" \
    "Spring tension set to 300"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "friction: 20" \
    "Spring friction set to 20"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "duration: 200" \
    "Opacity animation duration 200ms"

# ============================================================================
# Test 10: Create Button Preservation
# ============================================================================

print_header "Test 10: Verify Create Button Preserved"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "createBtnRing" \
    "Create button ring preserved"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "width: 60" \
    "Create button size 60px preserved"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "width: 68" \
    "Create button ring 68px preserved"

# ============================================================================
# Test 11: TypeScript Compilation
# ============================================================================

print_header "Test 11: TypeScript Compilation"

print_info "Running TypeScript compiler..."

if command -v npx &> /dev/null; then
    if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
        print_success "TypeScript compilation successful"
    else
        print_error "TypeScript compilation failed"
        print_info "Run 'npx tsc --noEmit' for details"
    fi
else
    print_info "npx not found, skipping TypeScript check"
fi

# ============================================================================
# Test 12: Code Quality
# ============================================================================

print_header "Test 12: Code Quality Checks"

# Check for proper cleanup
check_string_in_file "app/(tabs)/_layout.tsx" \
    "React.useEffect" \
    "useEffect hooks present"

# Check for console.log (should not exist)
if grep -q "console.log" "app/(tabs)/_layout.tsx" 2>/dev/null; then
    print_error "Found console.log statements (should remove)"
else
    print_success "No console.log statements"
fi

# Check for LinkedIn comments
check_string_in_file "app/(tabs)/_layout.tsx" \
    "LinkedIn" \
    "LinkedIn design attribution present"

# ============================================================================
# Test 13: Platform-Specific Code
# ============================================================================

print_header "Test 13: Platform-Specific Implementation"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Platform.select" \
    "Platform.select used"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "ios:" \
    "iOS-specific code"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "android:" \
    "Android-specific code"

# ============================================================================
# Results Summary
# ============================================================================

print_header "Test Results Summary"

echo -e "Total Tests: ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ All Tests Passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "LinkedIn-inspired tab bar enhancements are correctly implemented."
    echo ""
    echo "Next steps:"
    echo "  1. Run 'npm start' or 'expo start'"
    echo "  2. Test on iOS and Android devices"
    echo "  3. Verify animations are smooth (60fps)"
    echo "  4. Test haptic feedback on physical devices"
    echo "  5. Check shadow/elevation appearance"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Some Tests Failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Please review the errors above and fix them."
    echo "See TAB_BAR_ENHANCEMENT.md for implementation details."
    echo ""
    exit 1
fi
