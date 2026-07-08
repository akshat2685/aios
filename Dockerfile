# Dockerfile - Multi-stage build configuration

# Stage 1: Build packages and application
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ gcc curl
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json ./
RUN npm ci
RUN npm run build

# Stage 2: Runtime image
FROM node:20-alpine
RUN apk add --no-cache python3 ffmpeg curl
WORKDIR /app

# Download Whisper base model for local translation
RUN mkdir -p /root/.cache/spencer && \
    curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin -o /root/.cache/spencer/whisper-base-en.bin

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000
CMD ["npm", "start"]
