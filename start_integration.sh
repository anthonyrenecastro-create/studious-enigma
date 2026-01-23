#!/bin/bash

# Phase 1 Integration Startup Script
# Starts both Atlantean Backend and Quadra-Seer Frontend

echo "=================================================="
echo "  ATLANTEAN + QUADRA-SEER INTEGRATION"
echo "  Phase 1: Foundation"
echo "=================================================="
echo ""

# Check if Python dependencies are installed
echo "📦 Checking Python dependencies..."
python3 -c "import torch, flask, flask_cors" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Installing Python dependencies..."
    pip install torch numpy scikit-learn cryptography flask flask-cors -q
    echo "✅ Python dependencies installed"
fi

# Check if Node dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node dependencies..."
    npm install
fi

echo ""
echo "🚀 Starting Atlantean Backend on port 5001..."
python3 atlantean_backend.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
curl -s http://localhost:5001/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Atlantean Backend running (PID: $BACKEND_PID)"
else
    echo "❌ Atlantean Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🌐 Starting Quadra-Seer Frontend..."
echo ""
echo "=================================================="
echo "  READY!"
echo "=================================================="
echo ""
echo "  Atlantean Backend:  http://localhost:5001"
echo "  Quadra-Seer UI:     http://localhost:5173"
echo ""
echo "  To stop: Press Ctrl+C"
echo ""
echo "=================================================="
echo ""

# Start frontend (this will run in foreground)
npm run dev

# When frontend stops, kill backend
echo ""
echo "🛑 Stopping Atlantean Backend..."
kill $BACKEND_PID 2>/dev/null
echo "✅ Shutdown complete"
