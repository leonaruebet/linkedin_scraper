#!/bin/bash

echo ""
echo "=========================================="
echo "🐍 Python LinkedIn Scraper Setup"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found!"
    echo "   Install from: https://python.org"
    exit 1
fi

echo "✅ Python found: $(python3 --version)"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 not found!"
    exit 1
fi

echo "✅ pip3 found"

# Create virtual environment
echo ""
echo "📦 Setting up Python virtual environment..."
cd python-scraper

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate and install dependencies
echo ""
echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check ChromeDriver
echo ""
echo "🔍 Checking for ChromeDriver..."

if command -v chromedriver &> /dev/null; then
    echo "✅ ChromeDriver found: $(which chromedriver)"
    export CHROMEDRIVER=$(which chromedriver)
else
    echo "⚠️  ChromeDriver not found"
    echo ""
    echo "Installing ChromeDriver..."

    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install chromedriver
            export CHROMEDRIVER=/opt/homebrew/bin/chromedriver
            echo "✅ ChromeDriver installed via Homebrew"
        else
            echo "❌ Homebrew not found. Install manually:"
            echo "   https://chromedriver.chromium.org/"
            exit 1
        fi

    # Linux
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "For Linux, run:"
        echo "  wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE"
        echo "  wget https://chromedriver.storage.googleapis.com/\`cat LATEST_RELEASE\`/chromedriver_linux64.zip"
        echo "  unzip chromedriver_linux64.zip"
        echo "  sudo mv chromedriver /usr/local/bin/"
        exit 1

    else
        echo "❌ Unsupported OS. Download ChromeDriver manually:"
        echo "   https://chromedriver.chromium.org/"
        exit 1
    fi
fi

# Check credentials
echo ""
echo "🔐 Checking credentials..."

if [ -f "../.env.local" ]; then
    if grep -q "LINKEDIN_EMAIL" ../.env.local && grep -q "LINKEDIN_PASSWORD" ../.env.local; then
        echo "✅ Credentials found in .env.local"
    else
        echo "⚠️  Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD in .env.local"
        echo ""
        echo "Add to .env.local:"
        echo "  LINKEDIN_EMAIL=your-email@example.com"
        echo "  LINKEDIN_PASSWORD=your-password"
    fi
else
    echo "⚠️  .env.local not found"
    echo ""
    echo "Create .env.local with:"
    echo "  LINKEDIN_EMAIL=your-email@example.com"
    echo "  LINKEDIN_PASSWORD=your-password"
fi

# Final instructions
echo ""
echo "=========================================="
echo "✅ SETUP COMPLETE"
echo "=========================================="
echo ""
echo "To test:"
echo "  cd python-scraper"
echo "  source venv/bin/activate"
echo "  MAX_COMPANIES=5 python3 scrape_employees_python.py"
echo ""
echo "To run full scrape:"
echo "  cd python-scraper"
echo "  source venv/bin/activate"
echo "  python3 scrape_employees_python.py"
echo ""
echo "=========================================="
echo ""
