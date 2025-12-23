#!/bin/bash

# Run this script from the monorepo root with package name as argument
# Usage: ./init-package-by-name.sh mpt

PACKAGE_NAME="$1"

if [ -z "$PACKAGE_NAME" ]; then
    echo "Usage: $0 <package-name>"
    exit 1
fi

PACKAGE_DIR="packages/${PACKAGE_NAME}"
SOURCE_DIR="src/${PACKAGE_NAME}"

# Create package directory if it doesn't exist
mkdir -p "$PACKAGE_DIR"
cd "$PACKAGE_DIR"

echo "📦 Initializing bun library: @ts-ethereum/${PACKAGE_NAME}"

bun init -y

bun -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '@ts-ethereum/${PACKAGE_NAME}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Package name set to @ts-ethereum/${PACKAGE_NAME}"

if [ -d "../../${SOURCE_DIR}" ]; then
    rm -rf src/
    rm -f index.ts
    cp -r "../../${SOURCE_DIR}" ./src
    echo "✅ Source copied to ./src/"
else
    echo "❌ Source directory not found: ${SOURCE_DIR}"
    exit 1
fi

echo "🎉 Package @ts-ethereum/${PACKAGE_NAME} initialized successfully!"

# Go back to monorepo root for git commands
cd ../..

# Stage and commit the new package
echo "📝 Staging changes..."
git add "packages/${PACKAGE_NAME}"

echo "💾 Committing..."
git commit -m "feat: add @ts-ethereum/${PACKAGE_NAME} package"

echo "✅ Committed: feat: add @ts-ethereum/${PACKAGE_NAME} package"
