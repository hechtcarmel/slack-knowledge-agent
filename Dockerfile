# Multi-stage Dockerfile for Slack Knowledge Agent

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy root package files
COPY package.json pnpm-lock.yaml* ./

# Install root dependencies
RUN pnpm install

# Copy and install frontend dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml* ./frontend/
RUN cd frontend && pnpm install

# Copy and install backend dependencies
COPY backend/package.json backend/pnpm-lock.yaml* ./backend/
RUN cd backend && pnpm install

# Copy all source code
COPY . .

# Build both frontend and backend using the unified build system
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy backend package files
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod && pnpm store prune

# Copy built application from builder stage
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/public ./public

# Create logs directory for the application (if file logging is enabled)
RUN mkdir -p /app/logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables (only required ones from .env.example)
ENV NODE_ENV=production \
    PORT=8000 \
    LLM_MODEL=gpt-4o

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port 8000
EXPOSE 8000

# Start the application
CMD ["node", "dist/server.js"]