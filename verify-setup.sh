#!/bin/bash

echo "🚀 Excelr8 Setup Verification Script"
echo "====================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file found"
    
    # Check for required environment variables
    if grep -q "VITE_SUPABASE_URL" .env && grep -q "VITE_SUPABASE_ANON_KEY" .env; then
        echo "✅ Supabase environment variables found"
    else
        echo "❌ Missing Supabase environment variables"
        echo "   Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
    fi
    
    if grep -q "VITE_AIRTABLE_API_KEY" .env; then
        echo "✅ Airtable environment variables found"
    else
        echo "⚠️  Airtable API key not found (optional)"
    fi
    
    if grep -q "VITE_N8N_WEBHOOK_URL" .env; then
        echo "✅ n8n webhook configuration found"
    else
        echo "❌ Missing n8n webhook URL"
    fi
else
    echo "❌ .env file not found"
    echo "   Run: cp .env.example .env"
    echo "   Then update with your credentials"
fi

echo ""

# Check if node_modules exists
if [ -d node_modules ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Dependencies not installed"
    echo "   Run: npm install"
fi

echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    echo "   Please install Node.js v18 or higher"
fi

echo ""
echo "====================================="
echo "Setup verification complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "For full setup instructions, see README.md"
