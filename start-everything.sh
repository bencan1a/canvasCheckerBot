#!/bin/bash

# One-command startup for CanvasBot
# This script starts: vLLM + CanvasBot + Oobabooga + Network Access

echo "🤖 Starting CanvasBot..."
echo "========================"
echo ""
echo "This will start all services:"
echo "  • vLLM Server (high-performance LLM)"
echo "  • CanvasBot API (your Canvas data)"
echo "  • Oobabooga WebUI (chat interface)"
echo "  • Network access enabled (default)"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create a .env file with your Canvas credentials:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your Canvas URL and API token"
    echo ""
    exit 1
fi

# Show what will be accessible
echo "🌐 Network Access:"
LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n1)
if [ ! -z "$LOCAL_IP" ]; then
    echo "  Local:   http://localhost:7860"
    echo "  Network: http://${LOCAL_IP}:7860"
    echo "  (Accessible from phones, tablets on same Wi-Fi)"
else
    echo "  http://localhost:7860 (and network devices)"
fi
echo ""

# Prompt for confirmation
read -p "Continue? [Y/n]: " -r
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Starting services... (this may take a few minutes for first run)"
echo ""

# Run the full setup
exec ./canvasbot.sh full