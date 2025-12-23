#!/bin/bash

# Run this script from inside a package directory (e.g., packages/mpt/)
# It will initialize a bun library and copy source from src/<package-name>/

# Get the current directory name
CURRENT_DIR_NAME=$(basename "$(pwd)")

# Get the root of the monorepo (assuming we're in packages/some-package/)
MONOREPO_ROOT="$(cd ../.. && pwd)"

# Source directory path
SOURCE_DIR="${MONOREPO_ROOT}/src/${CURRENT_DIR_NAME}"

echo "📦 Initializing bun library: @ts-ethereum/${CURRENT_DIR_NAME}"

# Initialize bun library (non-interactive)
bun init -y

# Update package.json with the correct name
bun -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '@ts-ethereum/${CURRENT_DIR_NAME}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Package name set to @ts-ethereum/${CURRENT_DIR_NAME}"

# Check if source directory exists
if [ -d "$SOURCE_DIR" ]; then
    echo "📁 Copying source from: ${SOURCE_DIR}"
    
    # Remove any existing src directory or index.ts that bun init created
    rm -rf src/
    rm -f index.ts
    
    # Copy the source directory and rename to src/
    cp -r "$SOURCE_DIR" ./src
    
    echo "✅ Source copied to ./src/"
else
    echo "❌ Source directory not found: ${SOURCE_DIR}"
    exit 1
fi

echo "🎉 Package @ts-ethereum/${CURRENT_DIR_NAME} initialized successfully!"

