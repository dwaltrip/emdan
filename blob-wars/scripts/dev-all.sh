#!/bin/bash

# Development script for blob-wars - starts both frontend and backend

# Source fnm to ensure we're using the correct Node version
if command -v fnm &> /dev/null; then
    eval "$(fnm env --use-on-cd)"
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting blob-wars development servers..."

# Function to cleanup background processes on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill $SERVER_PID $UI_PID 2>/dev/null || true
    exit
}

# Cleanup on interactive stop (not EXIT — so background execution doesn't kill children)
trap cleanup SIGINT SIGTERM

# Start server (websocket backend)
echo "📦 Starting server..."
cd "$PROJECT_ROOT/server"
fnm use 2>/dev/null || true
VERBOSE="${VERBOSE-}" BOT_TOKEN="${BOT_TOKEN-}" pnpm dev &
SERVER_PID=$!

# Give the server a moment to start up
sleep 2

# Start UI (vite dev server)
echo "⚛️  Starting UI..."
cd "$PROJECT_ROOT/ui"
fnm use 2>/dev/null || true
pnpm dev &
UI_PID=$!

echo ""
echo "✅ Both servers are starting up..."
echo "   📦 Server: http://localhost:3002 (PID: $SERVER_PID)"
echo "   ⚛️  UI:     http://localhost:5173 (PID: $UI_PID)"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes to complete (or be interrupted)
wait $SERVER_PID $UI_PID
