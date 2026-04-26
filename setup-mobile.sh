#!/bin/bash

echo "🚀 Coldstar Mobile App Setup"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Build web assets
echo "🏗️  Building web assets..."
npm run build
echo ""

# Initialize Capacitor
echo "⚙️  Initializing Capacitor..."
if [ ! -f "capacitor.config.ts" ]; then
    npx cap init "Coldstar" "com.coldstar.wallet" --web-dir=dist
else
    echo "   Capacitor already initialized"
fi
echo ""

# Ask which platforms to add
echo "Which platforms would you like to add?"
echo "1) iOS only"
echo "2) Android only"
echo "3) Both iOS and Android"
read -p "Enter choice (1-3): " platform_choice

case $platform_choice in
    1)
        echo ""
        echo "📱 Adding iOS platform..."
        npx cap add ios
        npx cap sync ios
        echo ""
        echo "✅ iOS platform added!"
        echo ""
        echo "Next steps:"
        echo "1. Run: npm run cap:ios"
        echo "2. Open Xcode and build the project"
        ;;
    2)
        echo ""
        echo "🤖 Adding Android platform..."
        npx cap add android
        npx cap sync android
        echo ""
        echo "✅ Android platform added!"
        echo ""
        echo "Next steps:"
        echo "1. Run: npm run cap:android"
        echo "2. Open Android Studio and build the project"
        ;;
    3)
        echo ""
        echo "📱 Adding iOS platform..."
        npx cap add ios
        npx cap sync ios
        echo ""
        echo "🤖 Adding Android platform..."
        npx cap add android
        npx cap sync android
        echo ""
        echo "✅ Both platforms added!"
        echo ""
        echo "Next steps:"
        echo "- For iOS: npm run cap:ios"
        echo "- For Android: npm run cap:android"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=============================="
echo "✨ Setup complete!"
echo ""
echo "📖 Read MOBILE_BUILD_GUIDE.md for detailed instructions"
echo ""
