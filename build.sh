#!/usr/bin/env bash

# Install bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install dependencies
bun install

# Generate Prisma client
bun run prisma:generate

# Build the application
bun run build
