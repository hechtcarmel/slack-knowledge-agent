# Refactor Tasks: Frontend/Backend Separation

## Overview
Refactor the monolith structure into separate `backend/` and `frontend/` directories, each with their own package.json and dependencies. The production Dockerfile will build both and serve the frontend static assets from the backend.

**Status Legend:**
- ⬜ Not Started
- 🟨 In Progress  
- ✅ Completed
- ❌ Blocked

---

## Phase 1: Directory Structure Setup

### 1.1 Create Directory Structure
- ⬜ **Create backend directory** [5m]
  - `mkdir backend`
  - Prepare for moving existing code

- ⬜ **Create frontend directory** [5m]
  - `mkdir frontend`
  - `mkdir frontend/src`
  - `mkdir frontend/public`

### 1.2 Move Backend Code
- ⬜ **Move source files to backend/** [10m]
  - `mv src backend/`
  - `mv tests backend/`
  - `mv config backend/`
  - Verify all backend code is moved

- ⬜ **Move backend configuration files** [10m]
  - `mv tsconfig.json backend/`
  - `mv jest.config.js backend/`
  - Create new backend-specific configs

- ⬜ **Create backend package.json** [15m]
  - Copy dependencies from root package.json
  - Update scripts for backend-specific paths
  - Set correct main entry point
  - Configure TypeScript path aliases

### 1.3 Update Backend Code Paths
- ⬜ **Update import paths in backend code** [30m]
  - Check all `@/` imports still work
  - Update any relative paths that may have broken
  - Ensure TypeScript compilation works

- ⬜ **Update backend configuration** [15m]
  - Fix any hardcoded paths in configs
  - Update tsconfig.json paths if needed
  - Verify jest configuration paths

---

## Phase 2: Frontend Setup

### 2.1 Initialize Frontend Project
- ⬜ **Create frontend package.json** [20m]
  - Initialize new package.json
  - Add Vite, React, TypeScript dependencies
  - Add Tailwind CSS and PostCSS
  - Add Shadcn/ui dependencies
  - Configure build scripts

- ⬜ **Setup frontend configuration files** [20m]
  - Create `vite.config.ts`
  - Create `tsconfig.json` for frontend
  - Create `tailwind.config.js`
  - Create `postcss.config.js`
  - Create `index.html`

- ⬜ **Setup basic frontend structure** [15m]
  - Create `frontend/src/main.tsx`
  - Create `frontend/src/App.tsx` 
  - Create `frontend/src/index.css`
  - Setup basic Shadcn/ui components

### 2.2 Frontend Development Setup
- ⬜ **Configure frontend tooling** [20m]
  - Setup ESLint configuration
  - Setup Prettier configuration
  - Configure TypeScript strict mode
  - Add development dependencies

- ⬜ **Create basic UI structure** [30m]
  - Setup Shadcn/ui theme
  - Create basic components (Button, Input, Card)
  - Setup CSS variables
  - Test build process

---

## Phase 3: Root Configuration

### 3.1 Root Package.json Setup
- ⬜ **Update root package.json** [15m]
  - Keep as simple orchestration layer
  - Add concurrently dependency for development
  - Remove all backend-specific dependencies
  - Add root-level development scripts

### 3.2 Development Scripts
- ⬜ **Configure development scripts** [10m]
  - Root `dev` script: `concurrently "cd backend && pnpm dev" "cd frontend && pnpm dev"`
  - Root `build` script: build both projects sequentially
  - Root `install` script: install deps in both projects
  - Keep it simple without workspace complexity

### 3.3 Test Development Setup
- ⬜ **Test development workflow** [15m]
  - Run `pnpm install` in root (installs concurrently)
  - Run `cd backend && pnpm install`
  - Run `cd frontend && pnpm install` 
  - Test `pnpm dev` runs both projects
  - Verify frontend connects to backend API

---

## Phase 4: Docker Configuration

### 4.1 Update Dockerfile
- ⬜ **Create multi-stage Dockerfile** [45m]
  - Stage 1: Build frontend (Node + pnpm + build frontend)
  - Stage 2: Build backend (Node + pnpm + build backend) 
  - Stage 3: Production (Node + serve frontend + backend API)
  - Configure backend to serve frontend static files

- ⬜ **Update docker-compose.yml** [15m]
  - Ensure docker-compose uses updated Dockerfile
  - Configure environment variables
  - Set correct port mappings
  - Test container builds

### 4.2 Backend Static File Serving
- ⬜ **Configure Express static serving** [20m]
  - Add express.static middleware for frontend assets
  - Configure fallback to index.html for SPA routing
  - Set correct CORS and security headers
  - Test production serving

- ⬜ **Update backend package.json** [10m]
  - Add serve-static dependency if needed
  - Update build scripts to handle frontend integration
  - Configure production startup

---

## Phase 5: Configuration Updates

### 5.1 Update Configuration Files
- ⬜ **Update .gitignore** [10m]
  - Add frontend/dist/
  - Add frontend/node_modules/
  - Add backend/dist/
  - Add backend/node_modules/
  - Keep existing patterns

- ⬜ **Create .dockerignore** [10m]
  - Exclude node_modules from both projects
  - Exclude development files
  - Include only necessary build files
  - Optimize Docker build context

- ⬜ **Update .nvmrc and engine requirements** [5m]
  - Ensure Node version consistency
  - Update engine requirements in package.json
  - Verify version compatibility

### 5.2 Environment Configuration  
- ⬜ **Update environment variable handling** [15m]
  - Backend: Keep existing env vars
  - Frontend: Add VITE_ prefixed env vars
  - Update docker-compose environment section
  - Document environment setup

- ⬜ **Create development environment setup** [10m]
  - Update README with new dev setup instructions
  - Create example environment files
  - Document port configurations

---

## Phase 6: Testing and Verification

### 6.1 Development Testing
- ⬜ **Test development workflow** [30m]
  - Run `pnpm install` from root
  - Run `pnpm dev` and verify both services start
  - Test frontend connecting to backend API
  - Verify hot reload works for both projects

- ⬜ **Test build process** [20m]
  - Run `pnpm build` from root
  - Verify frontend builds to dist/
  - Verify backend builds to dist/
  - Test production serving

### 6.2 Docker Testing
- ⬜ **Test Docker build** [20m]
  - Build Docker image: `docker build -t ska .`
  - Run container: `docker run -p 3000:3000 ska`
  - Test API endpoints work
  - Test frontend loads and connects to backend

- ⬜ **Test Docker Compose** [15m]
  - Run `docker-compose up`
  - Verify all services start correctly
  - Test inter-service communication
  - Verify health checks pass

### 6.3 Final Verification
- ⬜ **Verify all functionality** [30m]
  - Test backend API endpoints
  - Test frontend UI components
  - Test end-to-end query flow
  - Verify all scripts work correctly

- ⬜ **Update documentation** [20m]
  - Update README.md with new structure
  - Update development setup instructions
  - Update Docker instructions
  - Update architecture documentation

---

## Phase 7: Cleanup

### 7.1 Remove Old Files
- ⬜ **Clean up root directory** [15m]
  - Remove old tsconfig.json from root
  - Remove old jest.config.js from root  
  - Remove any duplicate configuration files
  - Clean up unused dependencies in root package.json

- ⬜ **Verify no broken references** [15m]
  - Check all imports resolve correctly
  - Verify all configuration paths are correct
  - Test all npm scripts work
  - Ensure no hardcoded paths remain

### 7.2 Final Testing
- ⬜ **Complete integration test** [30m]
  - Fresh clone test: git clone and setup from scratch
  - Test all documented setup steps
  - Verify production Docker build works
  - Test development workflow end-to-end

---

## File Changes Summary

### New Files to Create:
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/jest.config.js`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `.dockerignore`

### Files to Move:
- `src/` → `backend/src/`
- `tests/` → `backend/tests/`
- `config/` → `backend/config/`
- `tsconfig.json` → `backend/tsconfig.json`
- `jest.config.js` → `backend/jest.config.js`

### Files to Update:
- `Dockerfile` (multi-stage build)
- `docker-compose.yml` (if needed)
- `.gitignore` (add frontend/backend patterns)
- Root `package.json` (simple orchestration scripts)
- `README.md` (development instructions)
- `docs/design.md` (architecture update)

### Files to Remove:
- Old configuration files from root after moving

---

## Estimated Time: ~8-10 hours total

**Critical Path Items:**
1. Directory structure and file moves (Phase 1-2)
2. Workspace setup and dependency management (Phase 3)
3. Docker configuration (Phase 4)
4. Testing and verification (Phase 6)

**Risk Items:**
- Import path updates in backend code
- Docker multi-stage build complexity
- Frontend/backend API integration
- Development workflow setup