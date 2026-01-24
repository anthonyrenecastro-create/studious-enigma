#!/bin/bash

# Start Everything Script for Studious Enigma
# This script starts Redis, Python backend, Node backend, and Frontend

echo "🚀 Starting Studious Enigma - UI + Node API + Python Core"

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "📦 Starting Redis..."
    redis-server --daemonize yes
    sleep 2
fi

# Start all services with concurrently
echo "🔄 Starting all services..."
npm run start:all