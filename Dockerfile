# Multi-stage Dockerfile for Slack Knowledge Agent

# Frontend build stage
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN npm install -g pnpm

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
RUN npm install -g pnpm

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
RUN npm install -g pnpm

# Copy backend package files
COPY backend/package.json ./
COPY backend/pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod && pnpm cache clean --force

# Copy built backend application from builder stage
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/config ./config

# Copy built frontend from frontend builder stage
COPY --from=frontend-builder /app/frontend/dist ./public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port
EXPOSE 8000

# Start the application
CMD ["node", "dist/server.js"]