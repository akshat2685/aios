# Dockerfile - Multi-stage microservices build

# Stage 1: Shared Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ gcc curl
WORKDIR /app

# Copy configuration and workspaces
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies and build
RUN npm ci
RUN npm run build

# Prune devDependencies to reduce image size
RUN npm prune --production

# Download Whisper base model for local translation
RUN mkdir -p /home/node/.cache/spencer && \
    curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin -o /home/node/.cache/spencer/whisper-base-en.bin

# Stage 2: Shared Runtime Base
FROM node:20-alpine AS runtime-base
RUN apk add --no-cache python3 ffmpeg

WORKDIR /app

# Switch to non-root user for Zero Trust
USER node

# Copy model cache with correct ownership
COPY --chown=node:node --from=builder /home/node/.cache/spencer /home/node/.cache/spencer

# Copy built workspaces and production node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps ./apps

# ---------------------------------------------------------
# MICROSERVICE TARGETS
# ---------------------------------------------------------

# Target: Model Gateway
FROM runtime-base AS model-gateway
EXPOSE 8080
# Using the discovered gateway endpoint
CMD ["node", "packages/api/dist/gateway.js"]

# Target: Memory Service
FROM runtime-base AS memory-service
EXPOSE 8081
# Note: Using placeholder entrypoint; update when service is fully integrated
CMD ["node", "packages/core/dist/memory-service.js"]

# Target: Agent Pods
FROM runtime-base AS agent-pods
EXPOSE 8080
# Note: Using daemon entrypoint as placeholder for agent pods
CMD ["node", "apps/daemon/dist/main/main/index.js"]

# Target: Legacy Daemon (Default)
FROM runtime-base AS default
EXPOSE 3000
CMD ["node", "apps/daemon/dist/main/main/index.js"]
