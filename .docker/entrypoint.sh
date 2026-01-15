#!/bin/sh
set -e

echo "Starting development servers and nginx proxy..."

# Create nginx config directory
mkdir -p /etc/nginx/conf.d
rm -f /etc/nginx/conf.d/games.conf

PORT=3001

# Start the server block
cat > /etc/nginx/conf.d/games.conf <<EOF
server {
    listen 80;
    server_name localhost;

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
EOF

# Start dev servers and generate nginx config for each game
for dir in */; do
  if [ -f "${dir}package.json" ] && [ "$dir" != "base_template/" ]; then
    GAME=${dir%/}
    echo "Starting $GAME on port $PORT..."
    (
      cd "$GAME"
      # Dynamically set Vite base path in config.dev.mjs
      if grep -q "base:" vite/config.dev.mjs; then
        sed -i "s|base:.*|base: '/$GAME/',|" vite/config.dev.mjs
      fi
      # More robust server configuration replacement
      # First, backup the original file
      cp vite/config.dev.mjs vite/config.dev.mjs.backup
      # Create a new config with proper server settings
      cat > vite/config.dev.mjs <<EOF
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/$GAME/',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: $PORT,
        host: '0.0.0.0',
        allowedHosts: ['dev-games.dijoker.com']
    }
});
EOF
      if [ -f "log.cjs" ]; then
        node log.cjs dev &
      fi
      vite --config vite/config.dev.mjs --port $PORT --host 0.0.0.0
    ) &
    # Add nginx location block for this game
    cat >> /etc/nginx/conf.d/games.conf <<EOF

    location /$GAME/ {
        proxy_pass http://127.0.0.1:$PORT/$GAME/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
EOF
    
    PORT=$((PORT+1))
  fi
done

# End the server block
cat >> /etc/nginx/conf.d/games.conf <<EOF
}
EOF

# Write main nginx config
cat > /etc/nginx/nginx.conf <<EOF
user nginx;
worker_processes 1;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    
    include /etc/nginx/conf.d/games.conf;
}
EOF

# Wait for dev servers to start
echo "Waiting for dev servers to start..."
sleep 10

echo "Starting nginx..."
nginx -g "daemon off;" 