#!/bin/bash

# Navigate to project directory
cd /home/bl423/project

# Stop any existing server sessions
echo "Stopping existing server instances..."
pkill -9 -f "node server.js" 2>/dev/null || true
tmux kill-session -t server 2>/dev/null || true

# Start the server in a new detached tmux session with log redirection
echo "Starting server in tmux session 'server'..."
tmux new-session -d -s server "node server.js > server_log.txt 2>&1"

# Confirm status
sleep 3
if tmux list-sessions 2>/dev/null | grep -q "server"; then
    echo "Server started successfully in tmux!"
    echo "Use 'tmux attach -t server' to view logs."
else
    echo "Failed to start server in tmux. Checking server_log.txt..."
    cat server_log.txt
fi
