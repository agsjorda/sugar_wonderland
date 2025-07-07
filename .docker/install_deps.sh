#!/bin/sh
set -e

echo "Installing global dependencies..."
npm install -g vite

echo "Installing dependencies for each game folder..."

for dir in */; do
  if [ -f "${dir}package.json" ] && [ "$dir" != "base_template/" ]; then
    echo "Installing dependencies for ${dir%/}..."
    cd "$dir"
    
    # Install npm dependencies
    npm install
    
    # Create log.cjs from log.js if it exists (for ES module compatibility)
    if [ -f "log.js" ]; then
      cp log.js log.cjs
    fi
    
    cd ..
  fi
done

echo "Dependencies installation complete." 