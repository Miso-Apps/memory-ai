#!/bin/bash
# Landing Page Swipe Functionality Test Script
# Tests all swipe-related elements and functionality

echo "🧪 Landing Page Swipe Functionality Test"
echo "=========================================="
echo ""

LANDING_FILE="landing/index.html"
PASS=0
FAIL=0

# Test 1: Check hero-phones-track wrapper exists
echo "Test 1: Hero phones track wrapper..."
if grep -q 'class="hero-phones-track"' "$LANDING_FILE"; then
  echo "✅ PASS: hero-phones-track div found"
  ((PASS++))
else
  echo "❌ FAIL: hero-phones-track div not found"
  ((FAIL++))
fi

# Test 2: Check phone indicators exist
echo "Test 2: Phone swipe indicators..."
if grep -q 'id="phone-indicators"' "$LANDING_FILE"; then
  echo "✅ PASS: Phone indicators found"
  ((PASS++))
else
  echo "❌ FAIL: Phone indicators not found"
  ((FAIL++))
fi

# Test 3: Check phone indicator dots (3 dots)
echo "Test 3: Phone indicator dots count..."
PHONE_DOTS=$(grep -A 3 'id="phone-indicators"' "$LANDING_FILE" | grep -c 'class="swipe-dot')
if [ "$PHONE_DOTS" -eq 3 ]; then
  echo "✅ PASS: 3 phone indicator dots found"
  ((PASS++))
else
  echo "❌ FAIL: Expected 3 phone dots, found $PHONE_DOTS"
  ((FAIL++))
fi

# Test 4: Check testimonials container wrapper
echo "Test 4: Testimonials container wrapper..."
if grep -q 'class="testimonials-container"' "$LANDING_FILE"; then
  echo "✅ PASS: testimonials-container found"
  ((PASS++))
else
  echo "❌ FAIL: testimonials-container not found"
  ((FAIL++))
fi

# Test 5: Check testimonial indicators exist
echo "Test 5: Testimonial swipe indicators..."
if grep -q 'id="testimonial-indicators"' "$LANDING_FILE"; then
  echo "✅ PASS: Testimonial indicators found"
  ((PASS++))
else
  echo "❌ FAIL: Testimonial indicators not found"
  ((FAIL++))
fi

# Test 6: Check testimonial indicator dots (3 dots)
echo "Test 6: Testimonial indicator dots count..."
TESTIMONIAL_DOTS=$(grep -A 3 'id="testimonial-indicators"' "$LANDING_FILE" | grep -c 'class="swipe-dot')
if [ "$TESTIMONIAL_DOTS" -eq 3 ]; then
  echo "✅ PASS: 3 testimonial indicator dots found"
  ((PASS++))
else
  echo "❌ FAIL: Expected 3 testimonial dots, found $TESTIMONIAL_DOTS"
  ((FAIL++))
fi

# Test 7: Check swipe CSS for hero-phones-track
echo "Test 7: Hero phones track mobile CSS..."
if grep -q '.hero-phones-track {' "$LANDING_FILE"; then
  echo "✅ PASS: hero-phones-track CSS found"
  ((PASS++))
else
  echo "❌ FAIL: hero-phones-track CSS not found"
  ((FAIL++))
fi

# Test 8: Check swipe indicators CSS
echo "Test 8: Swipe indicators CSS..."
if grep -q '.swipe-indicators {' "$LANDING_FILE"; then
  echo "✅ PASS: swipe-indicators CSS found"
  ((PASS++))
else
  echo "❌ FAIL: swipe-indicators CSS not found"
  ((FAIL++))
fi

# Test 9: Check swipe dot CSS
echo "Test 9: Swipe dot CSS..."
if grep -q '.swipe-dot {' "$LANDING_FILE"; then
  echo "✅ PASS: swipe-dot CSS found"
  ((PASS++))
else
  echo "❌ FAIL: swipe-dot CSS not found"
  ((FAIL++))
fi

# Test 10: Check active dot CSS
echo "Test 10: Active dot CSS..."
if grep -q '.swipe-dot.active {' "$LANDING_FILE"; then
  echo "✅ PASS: swipe-dot.active CSS found"
  ((PASS++))
else
  echo "❌ FAIL: swipe-dot.active CSS not found"
  ((FAIL++))
fi

# Test 11: Check mobile media query for phones
echo "Test 11: Mobile media query for phones..."
if grep -q '@media (max-width: 768px)' "$LANDING_FILE" && grep -A 5 '@media (max-width: 768px)' "$LANDING_FILE" | grep -q '.hero-phones {'; then
  echo "✅ PASS: Mobile media query for phones found"
  ((PASS++))
else
  echo "❌ FAIL: Mobile media query for phones not found"
  ((FAIL++))
fi

# Test 12: Check mobile media query for testimonials
echo "Test 12: Mobile media query for testimonials..."
if grep -A 5 '@media (max-width: 900px)' "$LANDING_FILE" | grep -q '.testimonials-grid {'; then
  echo "✅ PASS: Mobile media query for testimonials found"
  ((PASS++))
else
  echo "❌ FAIL: Mobile media query for testimonials not found"
  ((FAIL++))
fi

# Test 13: Check initSwipeCarousel function exists
echo "Test 13: initSwipeCarousel function..."
if grep -q 'function initSwipeCarousel' "$LANDING_FILE"; then
  echo "✅ PASS: initSwipeCarousel function found"
  ((PASS++))
else
  echo "❌ FAIL: initSwipeCarousel function not found"
  ((FAIL++))
fi

# Test 14: Check touch event listeners
echo "Test 14: Touch event listeners..."
if grep -q "addEventListener('touchstart'" "$LANDING_FILE" && grep -q "addEventListener('touchmove'" "$LANDING_FILE" && grep -q "addEventListener('touchend'" "$LANDING_FILE"; then
  echo "✅ PASS: Touch event listeners found"
  ((PASS++))
else
  echo "❌ FAIL: Touch event listeners not found"
  ((FAIL++))
fi

# Test 15: Check swipe initialization for phones
echo "Test 15: Phone swipe initialization..."
if grep -q "initSwipeCarousel('.hero-phones-track', 'phone-indicators')" "$LANDING_FILE"; then
  echo "✅ PASS: Phone swipe initialization found"
  ((PASS++))
else
  echo "❌ FAIL: Phone swipe initialization not found"
  ((FAIL++))
fi

# Test 16: Check swipe initialization for testimonials
echo "Test 16: Testimonial swipe initialization..."
if grep -q "initSwipeCarousel('.testimonials-grid', 'testimonial-indicators')" "$LANDING_FILE"; then
  echo "✅ PASS: Testimonial swipe initialization found"
  ((PASS++))
else
  echo "❌ FAIL: Testimonial swipe initialization not found"
  ((FAIL++))
fi

# Test 17: Check transform CSS for animation
echo "Test 17: Transform CSS for smooth sliding..."
if grep -q 'transform: translateX' "$LANDING_FILE"; then
  echo "✅ PASS: Transform CSS found"
  ((PASS++))
else
  echo "❌ FAIL: Transform CSS not found"
  ((FAIL++))
fi

# Test 18: Check transition CSS for smooth animation
echo "Test 18: Transition CSS for easing..."
if grep -q 'transition.*cubic-bezier' "$LANDING_FILE"; then
  echo "✅ PASS: Cubic-bezier transition found"
  ((PASS++))
else
  echo "❌ FAIL: Cubic-bezier transition not found"
  ((FAIL++))
fi

# Test 19: Check isMobile function
echo "Test 19: Mobile detection function..."
if grep -q "const isMobile = () => window.matchMedia('(max-width: 768px)')" "$LANDING_FILE"; then
  echo "✅ PASS: isMobile function found"
  ((PASS++))
else
  echo "❌ FAIL: isMobile function not found"
  ((FAIL++))
fi

# Test 20: Check velocity-based swipe detection
echo "Test 20: Velocity-based swipe detection..."
if grep -q 'velocity' "$LANDING_FILE" && grep -q 'deltaTime' "$LANDING_FILE"; then
  echo "✅ PASS: Velocity-based swipe detection found"
  ((PASS++))
else
  echo "❌ FAIL: Velocity-based swipe detection not found"
  ((FAIL++))
fi

# Test 21: Check edge resistance
echo "Test 21: Edge resistance at boundaries..."
if grep -q 'resistance' "$LANDING_FILE"; then
  echo "✅ PASS: Edge resistance found"
  ((PASS++))
else
  echo "❌ FAIL: Edge resistance not found"
  ((FAIL++))
fi

# Test 22: Check dot click handlers
echo "Test 22: Dot click navigation..."
if grep -q "dot.addEventListener('click'" "$LANDING_FILE"; then
  echo "✅ PASS: Dot click handlers found"
  ((PASS++))
else
  echo "❌ FAIL: Dot click handlers not found"
  ((FAIL++))
fi

# Test 23: Check resize handler
echo "Test 23: Window resize handler..."
if grep -q "addEventListener('resize'" "$LANDING_FILE"; then
  echo "✅ PASS: Resize handler found"
  ((PASS++))
else
  echo "❌ FAIL: Resize handler not found"
  ((FAIL++))
fi

# Test 24: Check touch-action CSS for scroll compatibility
echo "Test 24: Touch-action CSS for pan-y..."
if grep -q 'touch-action: pan-y' "$LANDING_FILE"; then
  echo "✅ PASS: touch-action: pan-y found"
  ((PASS++))
else
  echo "❌ FAIL: touch-action: pan-y not found"
  ((FAIL++))
fi

# Test 25: Check will-change optimization
echo "Test 25: Will-change optimization..."
if grep -q 'will-change: transform' "$LANDING_FILE"; then
  echo "✅ PASS: will-change: transform found"
  ((PASS++))
else
  echo "❌ FAIL: will-change: transform not found"
  ((FAIL++))
fi

echo ""
echo "=========================================="
echo "Summary: $PASS passed, $FAIL failed"
echo "=========================================="

if [ $FAIL -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi
