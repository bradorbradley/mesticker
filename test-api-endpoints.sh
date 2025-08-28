#!/bin/bash

echo "🔧 Testing Mesticker API Endpoints"
echo "=================================="

BASE_URL="http://localhost:3000"

echo ""
echo "1. Testing Environment Check..."
curl -s "${BASE_URL}/api/env-check" | jq '.'

echo ""
echo "2. Testing OpenAI Connection..."
curl -s "${BASE_URL}/api/openai-ok" | jq '.'

echo ""
echo "3. Testing Direct OpenAI API..."
if [ -n "$OPENAI_API_KEY" ]; then
    TEST_IMAGE="public/cartoon-presets/inputexample.jpg"
    
    if [ -f "$TEST_IMAGE" ]; then
        echo "   Testing with $TEST_IMAGE"
        curl -s -X POST https://api.openai.com/v1/images/edits \
          -H "Authorization: Bearer $OPENAI_API_KEY" \
          -F "model=gpt-image-1" \
          -F "image=@$TEST_IMAGE" \
          -F "prompt=Quick test" \
          -F "size=1024x1024" \
          -F "n=1" | head -10
    else
        echo "   No test image found at $TEST_IMAGE"
    fi
else
    echo "   OPENAI_API_KEY not set in shell - skipping direct test"
fi

echo ""
echo "4. Testing App Stylize Endpoint..."
TEST_IMAGE="public/cartoon-presets/inputexample.jpg"
if [ -f "$TEST_IMAGE" ]; then
    echo "   Testing with $TEST_IMAGE"
    curl -s -X POST "${BASE_URL}/api/stylize" \
        -F image="@$TEST_IMAGE" \
        -F style="Hey Arnold" | head -5
else
    echo "   No test image found at $TEST_IMAGE"
fi

echo ""
echo "✅ API endpoint tests complete."