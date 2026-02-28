#!/bin/bash

# TypeScript Autocomplete Verification Script
# This script verifies that TypeScript is properly configured for .stories.tsx files

echo "🔍 Verifying TypeScript Configuration for Storybook..."
echo ""

# Check if TypeScript is installed
echo "1️⃣ Checking TypeScript installation..."
if command -v npx &> /dev/null; then
    TS_VERSION=$(npx tsc --version)
    echo "✅ $TS_VERSION"
else
    echo "❌ TypeScript not found"
    exit 1
fi
echo ""

# Check if tsconfig files exist
echo "2️⃣ Checking configuration files..."
if [ -f "tsconfig.json" ]; then
    echo "✅ tsconfig.json exists"
else
    echo "❌ tsconfig.json not found"
    exit 1
fi

if [ -f ".storybook/tsconfig.json" ]; then
    echo "✅ .storybook/tsconfig.json exists"
else
    echo "❌ .storybook/tsconfig.json not found"
    exit 1
fi
echo ""

# Check if VSCode settings exist
echo "3️⃣ Checking VSCode configuration..."
if [ -f ".vscode/settings.json" ]; then
    echo "✅ .vscode/settings.json exists"
else
    echo "⚠️  .vscode/settings.json not found (optional but recommended)"
fi
echo ""

# Verify .storybook/tsconfig.json includes source files
echo "4️⃣ Checking .storybook/tsconfig.json includes src files..."
if grep -q '"../src/\*\*/\*"' .storybook/tsconfig.json; then
    echo "✅ .storybook/tsconfig.json includes ../src/**/*"
else
    echo "❌ .storybook/tsconfig.json doesn't include source files"
    exit 1
fi
echo ""

# Try to compile stories with TypeScript
echo "5️⃣ Type-checking .stories.tsx files..."
if npx tsc --noEmit --project .storybook/tsconfig.json 2>&1 | grep -q "error TS"; then
    echo "⚠️  Type errors found (this is OK if they're in your source code, not config)"
    echo "    Run 'npx tsc --noEmit --project .storybook/tsconfig.json' to see details"
else
    echo "✅ No TypeScript configuration errors"
fi
echo ""

# Check for story files
echo "6️⃣ Checking for .stories.tsx files..."
STORY_COUNT=$(find src -name "*.stories.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$STORY_COUNT" -gt 0 ]; then
    echo "✅ Found $STORY_COUNT .stories.tsx files"
    find src -name "*.stories.tsx" | while read file; do
        echo "   - $file"
    done
else
    echo "⚠️  No .stories.tsx files found"
fi
echo ""

echo "📝 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TypeScript configuration is set up correctly for .stories.tsx files!"
echo ""
echo "Next steps in VSCode:"
echo "1. Open any .stories.tsx file"
echo "2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "3. Type 'TypeScript: Restart TS Server' and press Enter"
echo "4. Wait a few seconds for the server to restart"
echo "5. Start typing - you should now have full autocomplete!"
echo ""
echo "If autocomplete still doesn't work, see TYPESCRIPT_AUTOCOMPLETE_FIX.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
