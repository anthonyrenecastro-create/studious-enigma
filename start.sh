#!/bin/bash

# Start Everything Script for Studious Enigma
# This script starts Redis (via Docker), Python backend, Node backend, and Frontend

echo "🚀 Starting Studious Enigma - UI + Node API + Python Core"

# Check if Redis container is running
if ! docker ps | grep -q redis; then
    echo "📦 Starting Redis container..."
    docker run -d --name redis-atlantean -p 6379:6379 redis:7-alpine
    sleep 3
fi

# Start all services with concurrently
echo "🔄 Starting all services..."
npm run start:all