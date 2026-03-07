#!/bin/bash

# ============================================================================
# LinkedIn-Inspired Design Changes - Test Script
# ============================================================================
# This script validates that all design changes are correctly implemented
# and verifies TypeScript compilation, code quality, and structure.
#
# Usage: bash test-design-changes.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
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

check_file_exists() {
    if [ -f "$1" ]; then
        print_success "File exists: $1"
        return 0
    else
        print_error "File not found: $1"
        return 1
    fi
}

check_string_in_file() {
    local file=$1
    local search_string=$2
    local description=$3
    
    if grep -q "$search_string" "$file"; then
        print_success "$description"
        return 0
    else
        print_error "$description (not found in $file)"
        return 1
    fi
}

# ============================================================================
# Test 1: File Structure
# ============================================================================

print_header "Test 1: Verify File Structure"

check_file_exists "app/(tabs)/_layout.tsx"
check_file_exists "app/capture.tsx"
check_file_exists "constants/theme.ts"
check_file_exists "DESIGN_CHANGES.md"

# ============================================================================
# Test 2: Import Validation
# ============================================================================

print_header "Test 2: Verify Required Imports"

# Check _layout.tsx imports
check_string_in_file "app/(tabs)/_layout.tsx" \
    "import.*Animated.*from 'react-native'" \
    "_layout.tsx imports Animated"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "import.*Platform.*from 'react-native'" \
    "_layout.tsx imports Platform"

# Check capture.tsx imports
check_string_in_file "app/capture.tsx" \
    "import.*Platform.*from 'react-native'" \
    "capture.tsx imports Platform"

check_string_in_file "app/capture.tsx" \
    "import.*Haptics.*from 'expo-haptics'" \
    "capture.tsx imports Haptics"

# ============================================================================
# Test 3: Create Button Changes
# ============================================================================

print_header "Test 3: Verify Create Button (FAB) Changes"

# Check for outer ring
check_string_in_file "app/(tabs)/_layout.tsx" \
    "createBtnRing" \
    "Outer ring style exists"

# Check button size (60px)
check_string_in_file "app/(tabs)/_layout.tsx" \
    "width: 60" \
    "Button width is 60px"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "height: 60" \
    "Button height is 60px"

# Check ring size (68px)
check_string_in_file "app/(tabs)/_layout.tsx" \
    "width: 68" \
    "Ring width is 68px"

# Check shadow properties
check_string_in_file "app/(tabs)/_layout.tsx" \
    "shadowRadius: 12" \
    "Enhanced shadow radius"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "elevation: 10" \
    "Android elevation is 10"

# Check animation
check_string_in_file "app/(tabs)/_layout.tsx" \
    "scaleAnim.*=.*useRef.*new Animated.Value" \
    "Scale animation initialized"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "Animated.spring" \
    "Spring animation used"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "onPressIn" \
    "Press in handler exists"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "onPressOut" \
    "Press out handler exists"

# ============================================================================
# Test 4: Mode Bar Changes
# ============================================================================

print_header "Test 4: Verify Bottom Mode Bar Changes"

# Check enhanced spacing
check_string_in_file "app/capture.tsx" \
    "paddingVertical: 10" \
    "Mode bar chip vertical padding is 10px"

check_string_in_file "app/capture.tsx" \
    "borderRadius: 24" \
    "Mode bar chip border radius is 24px"

check_string_in_file "app/capture.tsx" \
    "minHeight: 44" \
    "Mode bar chip min height is 44px"

# Check typography improvements
check_string_in_file "app/capture.tsx" \
    "fontSize: 16" \
    "Mode bar emoji size is 16px"

check_string_in_file "app/capture.tsx" \
    "fontSize: 13" \
    "Mode bar label size is 13px"

check_string_in_file "app/capture.tsx" \
    "letterSpacing: 0.2" \
    "Mode bar label has letter spacing"

# Check active state styling
check_string_in_file "app/capture.tsx" \
    "backgroundColor: colors.accent" \
    "Active chip uses full accent color"

check_string_in_file "app/capture.tsx" \
    "color: '#FFFFFF'" \
    "Active chip text is white"

check_string_in_file "app/capture.tsx" \
    "Platform.select" \
    "Platform-specific styling used"

check_string_in_file "app/capture.tsx" \
    "shadowColor: colors.accent" \
    "Shadow color matches accent"

check_string_in_file "app/capture.tsx" \
    "elevation: 4" \
    "Android elevation for active chip"

# Check haptic feedback
check_string_in_file "app/capture.tsx" \
    "Haptics.selectionAsync" \
    "Haptic feedback on mode selection"

# ============================================================================
# Test 5: TypeScript Compilation
# ============================================================================

print_header "Test 5: TypeScript Compilation Check"

print_info "Running TypeScript compiler..."

if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    print_success "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    print_info "Run 'npx tsc --noEmit' to see details"
fi

# ============================================================================
# Test 6: Code Quality
# ============================================================================

print_header "Test 6: Code Quality Checks"

# Check for console.log (should be console.error or removed)
if grep -r "console\.log" app/(tabs)/_layout.tsx app/capture.tsx 2>/dev/null; then
    print_error "Found console.log statements (should use console.error or remove)"
else
    print_success "No console.log statements found"
fi

# Check for proper comment formatting
check_string_in_file "app/(tabs)/_layout.tsx" \
    "// LinkedIn-inspired" \
    "Proper code documentation exists"

check_string_in_file "app/capture.tsx" \
    "// Enhanced with better spacing" \
    "Mode bar documentation exists"

# ============================================================================
# Test 7: Design Constants
# ============================================================================

print_header "Test 7: Design Constants Validation"

# Check theme colors exist
check_string_in_file "constants/theme.ts" \
    "accent:" \
    "Accent color defined in theme"

check_string_in_file "constants/theme.ts" \
    "accentLight:" \
    "Accent light color defined in theme"

# ============================================================================
# Test 8: Accessibility
# ============================================================================

print_header "Test 8: Accessibility Checks"

# Check touch target sizes
print_info "Verifying minimum touch target sizes (44x44px)..."

if grep -q "minHeight: 44" app/capture.tsx; then
    print_success "Mode bar chips meet minimum touch target size"
else
    print_error "Mode bar chips may not meet minimum touch target size"
fi

if grep -q "width: 60" app/(tabs)/_layout.tsx && grep -q "height: 60" app/(tabs)/_layout.tsx; then
    print_success "Create button meets minimum touch target size"
else
    print_error "Create button may not meet minimum touch target size"
fi

# ============================================================================
# Test 9: Animation Performance
# ============================================================================

print_header "Test 9: Animation Performance Checks"

# Check for useNativeDriver
check_string_in_file "app/(tabs)/_layout.tsx" \
    "useNativeDriver: true" \
    "Animations use native driver for performance"

# Check for proper cleanup
check_string_in_file "app/capture.tsx" \
    "useEffect.*return" \
    "Proper cleanup in useEffect hooks"

# ============================================================================
# Test 10: Platform-Specific Code
# ============================================================================

print_header "Test 10: Platform-Specific Implementation"

# iOS shadows
check_string_in_file "app/capture.tsx" \
    "shadowOffset:" \
    "iOS shadows implemented"

# Android elevation
check_string_in_file "app/capture.tsx" \
    "elevation:" \
    "Android elevation implemented"

check_string_in_file "app/(tabs)/_layout.tsx" \
    "elevation:" \
    "Create button Android elevation implemented"

# ============================================================================
# Test Results Summary
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
    echo "Design changes are correctly implemented."
    echo "Next steps:"
    echo "  1. Run 'npm start' or 'expo start'"
    echo "  2. Test on iOS and Android devices"
    echo "  3. Verify visual appearance and animations"
    echo "  4. Check dark mode (if implemented)"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Some Tests Failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Please review the errors above and fix them."
    echo "See DESIGN_CHANGES.md for implementation details."
    echo ""
    exit 1
fi
