#!/bin/bash

# Navigate to project directory
cd /home/bl423/project

# Stop any existing server sessions
echo "Stopping existing server instances..."
pkill -9 -f "node server.js" || true
tmux kill-session -t server 2>/dev/null || true

# Start the server in a new detached tmux session
echo "Starting server in tmux session 'server'..."
tmux new-session -d -s server "node server.js"

# Confirm status
sleep 2
if tmux list-sessions | grep -q "server"; then
    echo "Server started successfully in tmux!"
    echo "Use 'tmux attach -t server' to view logs."
else
    echo "Failed to start server. Check if tmux is installed."
fi
