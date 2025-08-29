# Multi-stage Dockerfile for Slack Knowledge Agent

# Frontend build stage
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy frontend package files
COPY frontend/package.json ./
COPY frontend/pnpm-lock.yaml* ./

# Install frontend dependencies
RUN pnpm install

# Copy frontend source code
COPY frontend/ .

# Build the frontend
RUN pnpm run build

# Backend build stage
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy backend package files
COPY backend/package.json ./
COPY backend/pnpm-lock.yaml* ./

# Install backend dependencies
RUN pnpm install

# Copy backend source code
COPY backend/ .

# Build the backend
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy backend package files
COPY backend/package.json ./
COPY backend/pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod && pnpm store prune

# Copy built backend application from builder stage
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/config ./config

# Copy built frontend from frontend builder stage to public directory
# The backend serves static files from 'public' directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Create logs directory for the application (if file logging is enabled)
RUN mkdir -p /app/logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables (matching .env.example defaults)
ENV NODE_ENV=production \
    PORT=8000 \
    # LLM Configuration (matching .env.example)
    DEFAULT_LLM_PROVIDER=openai \
    LLM_MODEL=gpt-4o \
    MAX_CONTEXT_TOKENS=8000 \
    # Query Configuration (matching .env.example)
    MAX_HISTORY_DAYS=90 \
    DEFAULT_QUERY_LIMIT=50 \
    MAX_QUERY_LIMIT=200 \
    # Memory Configuration (matching .env.example)
    MEMORY_ENABLED=true \
    MEMORY_MAX_TOKENS=200000 \
    MEMORY_MAX_MESSAGES=200 \
    MEMORY_SESSION_TTL_MINUTES=60 \
    MEMORY_CLEANUP_INTERVAL_MINUTES=10 \
    # Session Configuration (matching .env.example)
    SESSION_MAX_SESSIONS=1000 \
    SESSION_MAX_SESSIONS_PER_USER=10 \
    # Logging Configuration (Docker-specific: console only, no file logging)
    LOG_LEVEL=info \
    FILE_LOGGING=false \
    CONSOLE_LOGGING=true \
    LOG_DIR=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port 8000
EXPOSE 8000

# Start the application
CMD ["node", "dist/server.js"]